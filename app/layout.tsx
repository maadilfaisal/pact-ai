import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
    title: 'Pact — Good work. Fair pay.',
    description: 'A little clarity goes a long way. Agree on the brief, work together, and let an AI mediator help keep things fair.',
    icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) {
    return <html lang="en"><body>{children}</body></html>;
}
