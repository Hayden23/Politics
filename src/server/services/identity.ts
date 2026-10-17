import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import {
  appeals,
  bookmarks,
  comments,
  commentReactions,
  emailOutbox,
  notifications,
  consentRecords,
  contentReports,
  hiddenComments,
  moderationActions,
  questions,
  ratingHistory,
  ratings,
  sessions,
  stories,
  userBlocks,
  userCredentials,
  userDemographics,
  userPreferences,
  users,
} from "@/server/db/schema";
import { badRequest, conflict, unauthorized } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { AGE_RANGES, GEOGRAPHIC_TYPES, POLITICAL_IDS, US_STATES } from "@/domain/topics";

export const CONSENT_VERSION = "2026-10-01";
export const CONSENT_TYPES = ["terms_and_privacy", "demographics_processing"] as const;

const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  displayName: z.string().trim().min(2, "Display name is too short").max(40).regex(/^[\p{L}\p{N} ._-]+$/u, "Use letters, numbers, spaces, . _ or -"),
  acceptTerms: z.literal(true, { message: "You must accept the terms and privacy policy" }),
});

export async function signup(input: z.infer<typeof signupSchema>) {
  const email = input.email.toLowerCase();
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
    if (existing.length) throw conflict("An account with that email already exists", "email_taken");
    const [u] = await tx
      .insert(users)
      .values({ authProviderId: `password:${email}`, email, displayName: input.displayName, role: adminEmails().includes(email) ? "admin" : "user" })
      .returning();
    await tx.insert(userCredentials).values({ userId: u.id, passwordHash });
    await tx.insert(userPreferences).values({ userId: u.id });
    await tx.insert(consentRecords).values({ userId: u.id, consentType: "terms_and_privacy", consentVersion: CONSENT_VERSION, granted: true });
    return u;
  });
}

export async function login(emailRaw: string, password: string) {
  const email = emailRaw.trim().toLowerCase();
  const [row] = await db
    .select({ user: users, hash: userCredentials.passwordHash })
    .from(users)
    .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
    .where(sql`lower(${users.email}) = ${email}`);
  // Always run a hash comparison so timing doesn't reveal which emails exist.
  const ok = await verifyPassword(password, row?.hash ?? "scrypt$00$00");
  if (!row || !ok) throw unauthorized("Email or password is incorrect");
  if (row.user.accountStatus === "suspended") throw unauthorized("This account is suspended. You can appeal by contacting support.");
  if (row.user.accountStatus === "deleted") throw unauthorized("Email or password is incorrect");
  return row.user;
}

/** Sign-in through an OAuth provider: find by provider subject, else link by verified email, else create. */
export async function upsertOAuthUser(provider: string, subject: string, profile: { email: string | null; emailVerified: boolean; name: string | null }) {
  const authProviderId = `${provider}:${subject}`;
  const [existing] = await db.select().from(users).where(eq(users.authProviderId, authProviderId));
  if (existing) return existing;
  const email = profile.email?.toLowerCase() ?? null;
  if (email && profile.emailVerified) {
    const [byEmail] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
    if (byEmail) return byEmail;
  }
  return db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        authProviderId,
        email: profile.emailVerified ? email : null,
        displayName: (profile.name ?? "Reader").slice(0, 40),
        role: email && profile.emailVerified && adminEmails().includes(email) ? "admin" : "user",
      })
      .returning();
    await tx.insert(userPreferences).values({ userId: u.id });
    return u;
  });
}

// ───────────── Onboarding, preferences, demographics ─────────────

export const demographicsSchema = z.object({
  stateCode: z.enum(US_STATES).nullable().optional(),
  ageRange: z.enum(AGE_RANGES).nullable().optional(),
  geographicType: z.enum(GEOGRAPHIC_TYPES).nullable().optional(),
  politicalSelfIdentification: z.enum(POLITICAL_IDS).nullable().optional(),
});

export const onboardingSchema = z.object({
  topics: z.array(z.string().max(60)).max(20).default([]),
  /** Only stored when consent is given; otherwise ignored entirely. */
  demographicsConsent: z.boolean().default(false),
  demographics: demographicsSchema.optional(),
});

export async function completeOnboarding(userId: string, input: z.infer<typeof onboardingSchema>) {
  await db.transaction(async (tx) => {
    await tx
      .insert(userPreferences)
      .values({ userId, topicPreferences: input.topics })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { topicPreferences: input.topics, updatedAt: new Date() } });
    await setDemographicsTx(tx, userId, input.demographicsConsent, input.demographics ?? {});
    await tx.update(users).set({ onboardedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  });
}

type TxLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function setDemographicsTx(tx: TxLike, userId: string, consent: boolean, d: z.infer<typeof demographicsSchema>) {
  await tx.insert(consentRecords).values({ userId, consentType: "demographics_processing", consentVersion: CONSENT_VERSION, granted: consent });
  if (!consent) {
    await tx.delete(userDemographics).where(eq(userDemographics.userId, userId));
    return;
  }
  const values = {
    stateCode: d.stateCode ?? null,
    ageRange: d.ageRange ?? null,
    geographicType: d.geographicType ?? null,
    politicalSelfIdentification: d.politicalSelfIdentification ?? null,
    consentAt: new Date(),
    updatedAt: new Date(),
  };
  await tx.insert(userDemographics).values({ userId, ...values }).onConflictDoUpdate({ target: userDemographics.userId, set: values });
}

export async function setDemographics(userId: string, consent: boolean, d: z.infer<typeof demographicsSchema>) {
  await db.transaction((tx) => setDemographicsTx(tx, userId, consent, d));
}

export const preferencesSchema = z.object({
  displayName: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} ._-]+$/u).optional(),
  topics: z.array(z.string().max(60)).max(20).optional(),
  notificationFrequency: z.enum(["off", "daily", "weekly"]).optional(),
  showRatingOnComments: z.boolean().optional(),
});

export async function getSettings(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const [p] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  const [d] = await db.select().from(userDemographics).where(eq(userDemographics.userId, userId));
  return {
    displayName: u?.displayName ?? "",
    email: u?.email ?? null,
    topics: p?.topicPreferences ?? [],
    notificationFrequency: p?.notificationPreferences.frequency ?? "off",
    showRatingOnComments: p?.privacyPreferences.showRatingOnComments ?? false,
    demographics: d ? { stateCode: d.stateCode, ageRange: d.ageRange, geographicType: d.geographicType, politicalSelfIdentification: d.politicalSelfIdentification } : null,
  };
}

export async function updatePreferences(userId: string, input: z.infer<typeof preferencesSchema>) {
  await db.transaction(async (tx) => {
    if (input.displayName) await tx.update(users).set({ displayName: input.displayName, updatedAt: new Date() }).where(eq(users.id, userId));
    const [p] = await tx.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    const next = {
      topicPreferences: input.topics ?? p?.topicPreferences ?? [],
      notificationPreferences: { frequency: input.notificationFrequency ?? p?.notificationPreferences.frequency ?? "off" },
      privacyPreferences: {
        showRatingOnComments: input.showRatingOnComments ?? p?.privacyPreferences.showRatingOnComments ?? false,
        includeInDemographicAggregates: p?.privacyPreferences.includeInDemographicAggregates ?? false,
      },
      updatedAt: new Date(),
    };
    await tx.insert(userPreferences).values({ userId, ...next }).onConflictDoUpdate({ target: userPreferences.userId, set: next });
  });
}

// ───────────── Export & deletion ─────────────

/** Everything we hold about a person, in one JSON document. */
export async function exportUserData(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const myRatings = await db
    .select({ rating: ratings, questionText: questions.questionText, storyHeadline: stories.headline })
    .from(ratings)
    .innerJoin(questions, eq(questions.id, ratings.questionId))
    .innerJoin(stories, eq(stories.id, questions.storyId))
    .where(eq(ratings.userId, userId));
  const ids = myRatings.map((r) => r.rating.id);
  return {
    exportedAt: new Date().toISOString(),
    account: u && { id: u.id, email: u.email, displayName: u.displayName, role: u.role, accountStatus: u.accountStatus, createdAt: u.createdAt },
    preferences: (await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)))[0] ?? null,
    demographics: (await db.select().from(userDemographics).where(eq(userDemographics.userId, userId)))[0] ?? null,
    consents: await db.select().from(consentRecords).where(eq(consentRecords.userId, userId)),
    ratings: myRatings.map((r) => ({ ...r.rating, questionText: r.questionText, storyHeadline: r.storyHeadline })),
    ratingHistory: ids.length ? await db.select().from(ratingHistory).where(inArray(ratingHistory.ratingId, ids)) : [],
    comments: await db.select().from(comments).where(eq(comments.userId, userId)),
    reactions: await db.select().from(commentReactions).where(eq(commentReactions.userId, userId)),
    bookmarks: await db.select().from(bookmarks).where(eq(bookmarks.userId, userId)),
    reportsFiled: await db.select({ id: contentReports.id, targetType: contentReports.targetType, reason: contentReports.reason, status: contentReports.status, createdAt: contentReports.createdAt }).from(contentReports).where(eq(contentReports.reporterId, userId)),
    blocks: await db.select().from(userBlocks).where(eq(userBlocks.blockerId, userId)),
    moderationActions: await db.select({ id: moderationActions.id, action: moderationActions.action, reason: moderationActions.reason, createdAt: moderationActions.createdAt }).from(moderationActions).where(eq(moderationActions.targetUserId, userId)),
    appeals: await db.select().from(appeals).where(eq(appeals.userId, userId)),
    notifications: await db.select().from(notifications).where(eq(notifications.userId, userId)),
  };
}

/**
 * Account deletion. Political opinions and personal data are deleted outright;
 * the user row is kept only as a de-identified tombstone so foreign keys from
 * editorial records (approvals, audit log) stay valid.
 *
 *   deleted:      ratings + rating history, demographics, preferences, credentials,
 *                 sessions, bookmarks, reactions, blocks, hidden comments, appeals
 *   de-identified: comments (body replaced, marked deleted), consent records kept
 *                 against the tombstone as proof of what was agreed, reports keep
 *                 their content but lose the reporter link
 */
export async function deleteAccount(userId: string) {
  await db.transaction(async (tx) => {
    const myRatings = await tx.select({ id: ratings.id }).from(ratings).where(eq(ratings.userId, userId));
    if (myRatings.length) await tx.delete(ratingHistory).where(inArray(ratingHistory.ratingId, myRatings.map((r) => r.id)));
    await tx.delete(ratings).where(eq(ratings.userId, userId));
    await tx.delete(userDemographics).where(eq(userDemographics.userId, userId));
    await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await tx.delete(userCredentials).where(eq(userCredentials.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(bookmarks).where(eq(bookmarks.userId, userId));
    await tx.delete(commentReactions).where(eq(commentReactions.userId, userId));
    await tx.delete(userBlocks).where(eq(userBlocks.blockerId, userId));
    await tx.delete(userBlocks).where(eq(userBlocks.blockedId, userId));
    await tx.delete(hiddenComments).where(eq(hiddenComments.userId, userId));
    await tx.delete(appeals).where(eq(appeals.userId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(emailOutbox).where(eq(emailOutbox.userId, userId));
    await tx
      .update(comments)
      .set({ body: "[deleted]", status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(comments.userId, userId)));
    await tx.update(contentReports).set({ reporterId: null }).where(eq(contentReports.reporterId, userId));
    await tx
      .update(users)
      .set({ authProviderId: `deleted:${userId}`, email: null, displayName: null, role: "user", accountStatus: "deleted", deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  });
}

export function assertNotDeleted(u: { accountStatus: string }) {
  if (u.accountStatus === "deleted") throw badRequest("Account deleted");
}
