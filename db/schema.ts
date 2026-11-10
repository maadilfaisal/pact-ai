import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const pacts = sqliteTable('pacts', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    vendorUserId: text('vendor_user_id'),
    document: text('document').notNull(),
    version: integer('version').notNull().default(0),
    busyUntil: integer('busy_until').notNull().default(0),
    updatedAt: text('updated_at').notNull(),
});
export const vendorProfiles = sqliteTable('vendor_profiles', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    document: text('document').notNull(),
});
export const accounts = sqliteTable('accounts', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role', { enum: ['client', 'vendor'] }).notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
    tokenHash: text('token_hash').primaryKey(),
    accountId: text('account_id').notNull().references(() => accounts.id),
    expiresAt: integer('expires_at').notNull(),
});
export const authAttempts = sqliteTable('auth_attempts', {
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    resetAt: integer('reset_at').notNull(),
});
