export type Role = 'client' | 'vendor';
export type Stage = 'draft' | 'matching' | 'awaiting_vendor' | 'funding' | 'working' | 'revision' | 'ready' | 'completed' | 'cancelled';
export type CheckStatus = 'pending' | 'met' | 'missing' | 'clarify';
export type Requirement = {
    id: string;
    text: string;
    status: CheckStatus;
    evidence?: string;
    reason?: string;
};
export type Message = {
    id: string;
    role: 'client' | 'vendor' | 'agent' | 'system';
    agent?: 'Requirements' | 'Review' | 'Mediator';
    text: string;
    at: string;
    provider?: string;
};
export type WorkImage = {
    id: string;
    key: string;
    name: string;
    mimeType: 'image/png' | 'image/jpeg';
    size: number;
    width: number;
    height: number;
};
export type AgentImage = {
    name: string;
    mimeType: 'image/png' | 'image/jpeg';
    data: string;
    width: number;
    height: number;
};
export type Submission = {
    id: string;
    text: string;
    at: string;
    version: number;
    images?: WorkImage[];
};
export type Vendor = {
    userId?: string;
    id: string;
    name: string;
    initials: string;
    title: string;
    bio: string;
    skills: string[];
    color: string;
    demo: false;
    available: boolean;
};
export type Payment = {
    mode: 'demo' | 'sandbox';
    status: 'none' | 'created' | 'authorized' | 'captured' | 'voided';
    orderId?: string;
    authorizationId?: string;
    captureId?: string;
    approvalUrl?: string;
    authorizedAt?: string;
    capturedAt?: string;
};
export type Pact = {
    clientId?: string;
    clientName?: string;
    vendorUserId?: string;
    id: string;
    title: string;
    brief: string;
    budget: number;
    deadline: string;
    category: string;
    stage: Stage;
    demo: false;
    requirements: Requirement[];
    confirmedAt?: string;
    vendorId?: string;
    vendorAcceptedAt?: string;
    submissions: Submission[];
    messages: Message[];
    payment: Payment;
    createdAt: string;
    updatedAt: string;
    revision: number;
    scopeVersion: number;
    lastReviewSubmissionId?: string;
    clientAcceptedAt?: string;
};
export type Configuration = {
    ai: {
        connected: boolean;
        primary: string;
        backup: boolean;
    };
    paypal: {
        connected: boolean;
    };
    storage: boolean;
};
export type Workspace = {
    tasks: Pact[];
    vendors: Vendor[];
    config: Configuration;
    user: {
        name: string;
        id: string;
        role: Role;
        email: string;
    };
};
export const STAGE_LABELS: Record<Stage, string> = { draft: 'Clarifying the brief', matching: 'Find your person', awaiting_vendor: 'Waiting for vendor', funding: 'Ready to authorize', working: 'Work in progress', revision: 'A little revision', ready: 'Ready for your review', completed: 'All wrapped up', cancelled: 'Cancelled' };
export const EXAMPLE_BRIEF = 'Write a 300-word product description for Bloom, a reusable water bottle for university students. Use a friendly, conversational tone. Mention the stainless steel body, 24-hour insulation, and leakproof lid. Include comparisons with Hydro Flask and Stanley. Finish with a clear call to action. Deliver in English.';
