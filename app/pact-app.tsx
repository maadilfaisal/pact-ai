'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeft, Plus, LayoutGrid, BriefcaseBusiness, Users, LifeBuoy, Settings, Search, ChevronRight, ChevronDown, Check, CheckCheck, CheckCircle2, Clock3, ShieldCheck, Send, X, Sparkles, MoreHorizontal, FileText, MessageCircle, Wallet, ExternalLink, Copy, LoaderCircle, AlertCircle, Flower2, Handshake, Sun, CheckSquare2, RefreshCw, LogIn, Menu, BookOpen, SlidersHorizontal } from 'lucide-react';
import { STAGE_LABELS, EXAMPLE_BRIEF, type Pact, type Vendor, type Workspace, type Role, type Configuration } from '@/lib/pact/types';
type Page = 'home' | 'tasks' | 'vendors' | 'help' | 'settings' | 'create' | 'task';
const dateLabel = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const initials = (value: string) => value.split(/[\s._-]+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
function IconButton({ children, label, onClick }: {
    children: ReactNode;
    label: string;
    onClick: () => void;
}) { return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button>; }
function Badge({ children, tone = 'neutral' }: {
    children: ReactNode;
    tone?: string;
}) { return <span className={`badge ${tone}`}><span className="status-dot"/>{children}</span>; }
function AgentMark({ small = false }: {
    small?: boolean;
}) { return <span className={`agent-mark ${small ? 'small' : ''}`}><Sparkles size={small ? 13 : 18}/></span>; }
function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose); closeRef.current = onClose;
    useEffect(() => { const previous = document.activeElement as HTMLElement; const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; container.current?.querySelector<HTMLElement>('button,input,textarea')?.focus(); function key(e: KeyboardEvent) { if (e.key === 'Escape')
        closeRef.current(); if (e.key === 'Tab') {
        const items = container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,textarea,select,a[href]');
        if (!items?.length)
            return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    } } document.addEventListener('keydown', key); return () => { document.body.style.overflow = old; document.removeEventListener('keydown', key); previous?.focus(); }; }, []);
    return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
        onClose(); }}><div className="modal" ref={container} role="dialog" aria-modal="true" aria-label={title}><div className="modal-title"><h2>{title}</h2><IconButton label="Close dialog" onClick={onClose}><X size={20}/></IconButton></div>{children}</div></div>;
}
async function api(path: string, body?: unknown) {
    const multipart = body instanceof FormData;
    const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: body && !multipart ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) });
    const result: any = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || 'Please try again.'), { status: response.status });
    return result;
}
function AuthScreen() {
    const [register, setRegister] = useState(false);
    const [role, setRole] = useState<Role>('client');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError('');
        try { await api('/api/auth', { action: register ? 'register' : 'login', email: data.get('email'), password: data.get('password'), ...(register ? { name: data.get('name'), role, ...(role === 'vendor' ? { title: data.get('title'), bio: data.get('bio'), skills: String(data.get('skills')).split(',').map(s => s.trim()).filter(Boolean) } : {}) } : {}) }); window.location.reload(); }
        catch (e) { setError((e as Error).message); setBusy(false); }
    }
    return <main className="auth-shell"><section className="auth-story"><div className="brand"><span className="brand-symbol"><Handshake size={25}/></span><span>pact<span className="brand-period">.</span></span></div><span className="hero-tag"><Sparkles size={15}/> A little clarity goes a long way</span><h1>Good work.<br />Shared expectations.<br /><span>Better together.</span></h1><p>Turn your brief into a clear agreement. Find the right person, ask better questions, and get thoughtful feedback from your AI mediator.</p><div className="auth-flowers" aria-hidden="true"><Flower2 size={94} strokeWidth={1.2}/><Handshake size={72} strokeWidth={1.2}/><Sun size={64} strokeWidth={1.2}/></div><div className="reassurance-row"><span><CheckCheck size={18}/> Real accounts</span><span><Sparkles size={18}/> Connected AI</span></div></section><section className="auth-card"><div className="segmented"><button className={!register ? 'active' : ''} onClick={() => { setRegister(false); setError(''); }}>Sign in</button><button className={register ? 'active' : ''} onClick={() => { setRegister(true); setError(''); }}>Create account</button></div><h2>{register ? 'Your next good beginning.' : 'Lovely to see you again.'}</h2><p>{register ? 'One account, your own workspace.' : 'Sign in to pick up where you left off.'}</p>{error && <div className="error-banner" role="alert">{error}</div>}<form className="task-form" onSubmit={submit}>
    {register && <><label>Your name<input name="name" autoComplete="name" minLength={2} maxLength={60} required placeholder="Your full name"/></label><fieldset className="account-role"><legend>I’m here to…</legend><label><input type="radio" name="role" checked={role === 'client'} onChange={() => setRole('client')}/><span><strong>Hire someone</strong><small>I have work to get done.</small></span></label><label><input type="radio" name="role" checked={role === 'vendor'} onChange={() => setRole('vendor')}/><span><strong>Offer my skills</strong><small>I want to do great work.</small></span></label></fieldset></>}
    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></label><label>Password<span className="label-hint">At least 12 characters.</span><input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={12} maxLength={128} required placeholder="Your private password"/></label>
    {register && role === 'vendor' && <><label>Your introduction<input name="title" minLength={5} maxLength={100} required placeholder="e.g. Clear copy for growing brands"/></label><label>Skills<span className="label-hint">Separate with commas. These help clients find you.</span><input name="skills" maxLength={250} required placeholder="Content writing, Copywriting"/></label><label>About your work<textarea name="bio" rows={3} minLength={15} maxLength={500} required placeholder="Tell clients what you do best…"/></label></>}
    <button className="button primary wide" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <ArrowRight size={17}/>} {busy ? 'One moment…' : register ? 'Create my account' : 'Sign in'}</button></form><p className="form-fine">Your tasks and conversations stay between their participants.<br />Test payments only. No real money moves.</p></section></main>;
}
export default function PactApp() {
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState(true);
    const [anonymous, setAnonymous] = useState(false);
    const [page, setPage] = useState<Page>('home');
    const [selected, setSelected] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState('');
    const busyRef = useRef(''); busyRef.current = busy;
    const [search, setSearch] = useState('');
    const [mobileNav, setMobileNav] = useState(false);
    const [isNarrow, setIsNarrow] = useState(false);
    const [modal, setModal] = useState<'vendor' | 'cancel' | 'capture' | null>(null);
    async function load() {
        try { const value = await api('/api/workspace') as Workspace; setWorkspace(current => current && current.user.id === value.user.id ? { ...value, tasks: value.tasks.map(t => { const existing = current.tasks.find(c => c.id === t.id); return existing && existing.updatedAt > t.updatedAt ? existing : t; }) } : value); setAnonymous(false); }
        catch (e) { if ((e as { status?: number }).status === 401) { setAnonymous(true); setWorkspace(null); } else setError((e as Error).message); }
        finally { setLoading(false); }
    }
    useEffect(() => { const queryParams = new URLSearchParams(window.location.search); const id = queryParams.get('task'); const payment = queryParams.get('payment'); if (payment === 'authorized') setNotice('PayPal Sandbox confirmed the authorization. Work can begin.'); if (payment === 'cancelled') setNotice('PayPal checkout was cancelled. You can resume it from this task.'); if (payment === 'error') setError('PayPal approval could not be confirmed. No successful authorization was recorded. Reopen checkout to check the same order.'); if (id) { setSelected(id); setPage('task'); } void load(); const timer = setInterval(() => { if (!busyRef.current && document.visibilityState === 'visible') void load(); }, 8000); function focus() { if (!busyRef.current) void load(); } window.addEventListener('focus', focus); const query = window.matchMedia('(max-width:760px)'); function narrow() { setIsNarrow(query.matches); } narrow(); query.addEventListener('change', narrow); return () => { clearInterval(timer); window.removeEventListener('focus', focus); query.removeEventListener('change', narrow); }; }, []);
    useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
    function navigate(next: Page) { setPage(next); setSearch(''); setMobileNav(false); setError(''); window.history.replaceState({}, '', '/'); }
    function openTask(task: Pact) { setSelected(task.id); setPage('task'); setMobileNav(false); setError(''); window.history.replaceState({}, '', `/?task=${task.id}`); }
    function updateTask(task: Pact) { setWorkspace(w => w ? { ...w, tasks: [task, ...w.tasks.filter(t => t.id !== task.id)] } : w); }
    async function act(action: string, data: Record<string, unknown> | FormData = {}) { if (!selected) return; setBusy(action); setError(''); try { if (data instanceof FormData) data.set('action', action); const result = await api(`/api/tasks/${selected}/action`, data instanceof FormData ? data : { action, ...data }); updateTask(result.task); if (result.warning) setNotice(result.warning); if (result.redirect) window.location.assign(result.redirect); return result.task as Pact; } catch (e) { setError((e as Error).message); } finally { setBusy(''); } }
    async function logout() { setBusy('logout'); try { await api('/api/auth', { action: 'logout' }); window.location.assign('/'); } catch (e) { setError((e as Error).message); setBusy(''); } }
    if (loading) return <main className="loading-workspace"><span className="brand-symbol"><Handshake size={28}/></span><h2>Getting your workspace ready.</h2><LoaderCircle className="spin" size={22}/></main>;
    if (anonymous) return <AuthScreen/>;
    if (!workspace) return <main className="loading-workspace"><p role="alert">{error || 'Could not load your workspace.'}</p><button className="button primary" onClick={() => void load()}>Try again</button></main>;
    const { user, config, vendors, tasks } = workspace;
    const client = user.role === 'client';
    const task = tasks.find(t => t.id === selected);
    const active = tasks.filter(t => !['completed', 'cancelled'].includes(t.stage));
    const invited = active.filter(t => t.stage === 'awaiting_vendor');
    const ownProfile = vendors.find(v => v.userId === user.id);
    const nav = [{ id: 'home' as Page, label: 'Overview', icon: LayoutGrid }, { id: 'tasks' as Page, label: 'My tasks', icon: BriefcaseBusiness }, { id: 'vendors' as Page, label: client ? 'Find talent' : 'My profile', icon: Users }];
    const shownTasks = tasks.filter(t => (page === 'home' ? !['completed', 'cancelled'].includes(t.stage) : true) && (t.title + t.brief).toLowerCase().includes(search.toLowerCase()));
    return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a>{mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`} inert={isNarrow && !mobileNav}><button className="brand" onClick={() => navigate('home')}><span className="brand-symbol"><Handshake size={23}/></span><span>pact<span className="brand-period">.</span></span></button><p className="sidebar-caption">GOOD WORK STARTS HERE</p><nav aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${page === id || (id === 'tasks' && ['task', 'create'].includes(page)) ? 'selected' : ''}`} onClick={() => navigate(id)}><Icon size={19}/><span>{label}</span>{id === 'tasks' && active.length > 0 && <span className="nav-count">{active.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="little-note"><Flower2 size={30}/><p>A little clarity.<br /><strong>A lot of possibility.</strong></p></div><button className={`nav-item ${page === 'help' ? 'selected' : ''}`} onClick={() => navigate('help')}><LifeBuoy size={19}/> How it works</button><button className={`nav-item ${page === 'settings' ? 'selected' : ''}`} onClick={() => navigate('settings')}><Settings size={19}/> My account</button><button className="nav-item" disabled={!!busy} onClick={() => void logout()}><LogIn size={19}/> Sign out</button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-left"><span className="mobile-only"><IconButton label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20}/></IconButton></span><span className="breadcrumb">Your workspace <ChevronRight size={13}/><strong>{page === 'task' ? 'Task workroom' : page === 'home' ? 'Overview' : page === 'create' ? 'New task' : page === 'vendors' ? client ? 'Find talent' : 'My profile' : page === 'settings' ? 'My account' : page === 'help' ? 'How it works' : 'My tasks'}</strong></span></div><div className="topbar-actions"><span className="workspace-mode"><span className="tiny-pink-dot"/>{client ? 'Client account' : 'Vendor account'}</span><button className="user-avatar" aria-label="My account" onClick={() => navigate('settings')}>{initials(user.name)}</button></div></header>
    <main id="main" className={`main-content ${page === 'task' ? 'workroom-main' : ''}`}>{error && <div className="error-banner" role="alert"><AlertCircle size={18}/><span>{error}</span><IconButton label="Dismiss error" onClick={() => setError('')}><X size={16}/></IconButton></div>}
    {(page === 'home' || page === 'tasks') && <><div className="page-heading"><div><p className="eyebrow">{page === 'home' ? 'A FRESH START, TOGETHER' : 'FROM FIRST BRIEF TO FINAL HANDOFF'}</p><h1>{page === 'home' ? `Hey ${user.name.split(' ')[0]}` : 'My tasks'}<span className="greeting-dot">.</span></h1><p>{client ? 'Let’s make good work happen.' : 'Your invitations, conversations, and work in one place.'}</p></div>{client && <button className="button primary" onClick={() => navigate('create')}><Plus size={18}/> Create a task</button>}</div>
    {page === 'home' && <section className="welcome-grid"><div className="hero-panel"><div className="hero-copy"><span className="hero-tag"><Sparkles size={13}/> Your AI mediator, by your side</span><h2>Less back-and-forth.<br />More <span className="pink-text">good work.</span></h2><p>{client ? 'Tell us what you need. Confirm the brief, invite a vendor, and keep every expectation clear.' : 'Review a clear agreement. Share your work, explain your choices, and improve it together.'}</p><button className="button dark" onClick={() => navigate(client ? 'create' : 'tasks')}>{client ? 'Let’s start something' : 'See my tasks'}<ArrowUpRight size={17}/></button></div><div className="pact-hero-flower" aria-hidden="true"><Flower2 size={130} strokeWidth={1}/><span><Handshake size={35}/></span></div></div><div className="demo-panel real-summary"><span className="demo-panel-top">{client ? 'YOUR SHARED WORK' : 'READY FOR YOUR YES'}<Sun size={21}/></span><strong className="summary-number">{client ? active.length : invited.length}</strong><h3>{client ? 'Ideas in motion.' : 'New invitations.'}</h3><p>{client ? 'Your brief, your vendor, and your AI guide. All on the same page.' : 'Invitations appear here when a client chooses your registered profile.'}</p><button className="text-link" onClick={() => navigate('tasks')}>Open my tasks <ArrowRight size={15}/></button></div></section>}
    <section className="tasks-section"><div className="section-heading"><div><h2>{page === 'home' ? 'Your work, moving forward' : 'Your shared tasks'} <span className="number-pill">{shownTasks.length}</span></h2><p>One clear next step at a time.</p></div><button className="text-button" disabled={!!busy} onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>{page === 'tasks' && <div className="list-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Find a task…"/></div>}{shownTasks.length ? <div className="task-grid">{shownTasks.map(t => <TaskCard key={t.id} task={t} vendor={vendors.find(v => v.id === t.vendorId)} onClick={() => openTask(t)}/>)}</div> : <div className="empty-state"><span className="yellow-icon"><Flower2 size={30}/></span><h3>{client ? 'Your next idea starts here.' : 'Good work is on its way.'}</h3><p>{client ? 'Create a task and turn your brief into a clear agreement.' : 'Keep your skills up to date. A client can invite you from Find talent.'}</p><button className="button secondary" onClick={() => navigate(client ? 'create' : 'vendors')}>{client ? 'Create a task' : 'View my profile'}<ArrowRight size={16}/></button></div>}</section></>}
    {page === 'create' && client && <CreateTask config={config} signedIn={true} onSignIn={() => true} busy={busy === 'create'} onBack={() => navigate('home')} onCreate={async data => { setBusy('create'); setError(''); try { const result = await api('/api/tasks', data); updateTask(result.task); openTask(result.task); } catch (e) { setError((e as Error).message); } finally { setBusy(''); } }}/>}
    {page === 'vendors' && <><div className="page-heading"><div><p className="eyebrow">GOOD PEOPLE. SHARED EXPECTATIONS.</p><h1>{client ? 'Find your person' : 'Your skills, out there'}<span className="greeting-dot">.</span></h1><p>{client ? 'Real vendor accounts. Match by skills and invite from a confirmed task.' : 'Clients see this profile when choosing someone for their task.'}</p></div>{!client && <button className="button primary" onClick={() => setModal('vendor')}>Edit my profile</button>}</div>{client && <div className="list-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search names or skills…"/></div>}<VendorGrid vendors={client ? vendors.filter(v => (v.name + ' ' + v.skills.join(' ')).toLowerCase().includes(search.toLowerCase())) : ownProfile ? [ownProfile] : []} onSelect={() => client ? navigate('create') : setModal('vendor')} buttonLabel={client ? 'Start a brief' : 'Edit my profile'}/>{!vendors.length && <div className="empty-state"><Users size={30}/><h3>A little room for good people.</h3><p>Vendors will appear after they register their own accounts. No sample profiles are shown.</p></div>}</>}
    {page === 'task' && (task ? <Workroom key={task.id} task={task} vendors={vendors} role={user.role} busy={busy} act={act} onBack={() => navigate('tasks')} onCapture={() => setModal('capture')} onCancel={() => setModal('cancel')}/> : <div className="empty-state"><h3>This task isn’t in your workspace.</h3><p>Sign in with the client or invited vendor account.</p><button className="button secondary" onClick={() => navigate('tasks')}>My tasks</button></div>)}
    {page === 'help' && <Help client={client} onStart={() => navigate(client ? 'create' : 'tasks')}/>}
    {page === 'settings' && <Connections config={config} user={user} onRefresh={() => void load()} onLogout={() => void logout()}/>}
    <footer className="page-footer"><span>pact. <span>Good work. Fair pay.</span></span><button onClick={() => navigate('help')}>A little help? <ArrowUpRight size={13}/></button></footer></main></div>
    {notice && <div className="toast" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}
    {modal === 'vendor' && !client && <VendorForm vendor={ownProfile} busy={busy === 'vendor'} onClose={() => setModal(null)} onSave={async data => { setBusy('vendor'); try { await api('/api/vendors', data); await load(); setModal(null); setNotice('Your profile is updated.'); } catch (e) { setError((e as Error).message); setModal(null); } finally { setBusy(''); } }}/>}
    {modal === 'cancel' && task && <Modal title="Cancel this task?" onClose={() => setModal(null)}><p className="modal-description">The agreement and conversation will stay saved for both participants.</p><div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Keep working</button><button className="button danger" disabled={!!busy} onClick={async () => { await act('cancel'); setModal(null); }}>Cancel task</button></div></Modal>}
    {modal === 'capture' && task && <Modal title="A good finish, together." onClose={() => setModal(null)}><div className="finish-illustration"><CheckCheck size={38}/></div><p className="modal-description">You’re accepting submission version {task.submissions.length} against the confirmed agreement.</p><div className="receipt-mini"><span>{task.payment.mode === 'demo' ? 'Simulated payment' : 'PayPal Sandbox capture'}</span><strong>{money(task.budget)}</strong></div><p className="fine-print">{task.payment.mode === 'demo' ? 'The work and acceptance are real. The payment is simulated; no money moves.' : 'PayPal Sandbox uses test funds only.'}</p><div className="modal-actions"><button className="button secondary" onClick={() => setModal(null)}>Review again</button><button className="button primary" disabled={!!busy} onClick={async () => { await act('capture'); setModal(null); }}>Accept & complete <CheckCheck size={16}/></button></div></Modal>}
    </div>;
}
function SearchBox({ value, onChange, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
}) { return <label className="search-box"><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/>{value && <button aria-label="Clear search" onClick={() => onChange('')}><X size={14}/></button>}</label>; }
function Empty({ title = 'Your next idea starts here.', description = 'Create a task and turn your brief into a clear agreement.', onCreate }: {
    title?: string;
    description?: string;
    onCreate: () => void;
}) { return <div className="empty-state"><span className="yellow-icon"><Flower2 size={28}/></span><h3>{title}</h3><p>{description}</p><button className="button secondary" onClick={onCreate}>Create a task <Plus size={16}/></button></div>; }
function TaskCard({ task, vendor, onClick }: {
    task: Pact;
    vendor?: Vendor;
    onClick: () => void;
}) { const done = task.requirements.filter(r => r.status === 'met').length; const total = task.requirements.length; const tone = task.stage === 'completed' ? 'green' : task.stage === 'revision' ? 'amber' : task.stage === 'cancelled' ? 'neutral' : 'pink'; return <button className="task-card" onClick={onClick}><div className="task-card-top"><span className="task-category"><FileText size={14}/>{task.category}</span><ArrowUpRight size={19}/></div><h3>{task.title}</h3><Badge tone={tone}>{STAGE_LABELS[task.stage]}</Badge><div className="task-progress"><div><span>{task.stage === 'draft' ? 'Draft checklist' : `${done} of ${total} requirements met`}</span><strong>{Math.round(done / total * 100)}%</strong></div><span className="progress-track"><i style={{ width: `${done / total * 100}%` }}/></span></div><div className="task-card-footer"><span className="vendor-mini">{vendor ? <><b className={`avatar ${vendor.color}`}>{vendor.initials}</b>{vendor.name.split(' ')[0]}</> : <><span className="unassigned-avatar"><Users size={13}/></span>Not assigned yet</>}</span><strong>{money(task.budget)}</strong></div><div className="task-card-bottom"><span><Clock3 size={12}/> Due {dateLabel(task.deadline)}</span></div></button>; }
function CreateTask({ config, signedIn, onSignIn, onCreate, busy, onBack }: {
    config: Configuration;
    signedIn: boolean;
    onSignIn: () => boolean;
    onCreate: (data: unknown) => Promise<void>;
    busy: boolean;
    onBack: () => void;
}) {
    const [title, setTitle] = useState('');
    const [brief, setBrief] = useState('');
    const [budget, setBudget] = useState('10');
    const [deadline, setDeadline] = useState(() => new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
    const [category, setCategory] = useState('Content writing');
    async function submit(e: FormEvent) { e.preventDefault(); if (!onSignIn())
        return; await onCreate({ title, brief, budget: Number(budget), deadline, category }); }
    return <div className="create-layout"><div className="create-main"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Back to overview</button><p className="eyebrow">STEP 1 · A CLEAR BEGINNING</p><h1>What are we<br />making happen<span className="greeting-dot">?</span></h1><p className="create-lead">Start with your idea. We’ll help turn it into a brief everyone understands.</p><form className="task-form" onSubmit={submit}><label>Give your task a name<input required minLength={3} maxLength={100} placeholder="e.g. A fresh voice for my new product" value={title} onChange={e => setTitle(e.target.value)}/></label><label>Tell us what you have in mind<span className="label-hint">Include the audience, deliverable, format, and must-haves.</span><textarea required minLength={30} maxLength={12000} rows={7} placeholder="I’m looking for someone to write…" value={brief} onChange={e => setBrief(e.target.value)}/></label><div className="form-sample"><span>A blank page can be tricky.</span><button type="button" onClick={() => { setTitle('A fresh voice for Bloom'); setBrief(EXAMPLE_BRIEF); setCategory('Content writing'); }}>Try an example <Sparkles size={13}/></button></div><div className="form-row"><label>Budget (USD)<div className="input-prefix"><span>$</span><input required type="number" min="1" max="10000" step="0.01" value={budget} onChange={e => setBudget(e.target.value)}/></div></label><label>Delivery date<input required type="date" min={new Date().toISOString().slice(0, 10)} value={deadline} onChange={e => setDeadline(e.target.value)}/></label></div><label>Type of work<select value={category} onChange={e => setCategory(e.target.value)}><option>Content writing</option><option>Copywriting</option><option>Social media</option></select></label><p className="soft-note"><Sparkles size={15}/> Your brief is clarified by connected AI. Payments are simulated unless PayPal Sandbox is configured.</p><button className="button primary wide" type="submit" disabled={busy || !config.ai.connected}>{busy ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={17}/>} {busy ? 'Making your brief clearer…' : 'Help me clarify my brief'} {!busy && <ArrowRight size={17}/>}</button><p className="form-fine">Nothing is posted or charged yet. You’ll confirm the checklist first.</p></form></div><aside className="create-aside"><div className="clarity-note"><div className="note-flower"><Flower2 size={48} strokeWidth={1.2}/></div><p className="eyebrow">LET’S GET ON THE SAME PAGE</p><h2>A good brief.<br />A better beginning.</h2><p>Your AI guide will help you spot the little details that make a big difference.</p><div className="note-checks"><span><Check size={16}/> What does “done” look like?</span><span><Check size={16}/> What absolutely needs to be there?</span><span><Check size={16}/> What might need a little explanation?</span></div><div className="note-footer"><AgentMark small/><span>You have the final say.</span></div></div><p className="aside-fine"><ShieldCheck size={17}/> Your confirmed checklist stays the source of truth throughout the task.</p></aside></div>;
}
function VendorGrid({ vendors, onSelect, buttonLabel = 'Invite to task', category, disabled=false }: {
    vendors: Vendor[];
    onSelect: (v: Vendor) => void;
    buttonLabel?: string;
    category?: string;
    disabled?: boolean;
}) { const sorted = [...vendors].sort((a, b) => Number(b.skills.some(s => s.toLowerCase() === category?.toLowerCase())) - Number(a.skills.some(s => s.toLowerCase() === category?.toLowerCase()))); return <div className="vendor-grid">{sorted.map((v, i) => <article className="vendor-card" key={v.id}><div className="vendor-card-top"><span className={`avatar big ${v.color}`}>{v.initials}</span><Badge tone={v.available ? 'green' : 'neutral'}>{v.available ? 'Available' : 'Unavailable'}</Badge></div><h3>{v.name}</h3><p className="vendor-tagline">{v.title}</p><p className="vendor-bio">{v.bio}</p><div className="skill-tags">{v.skills.map(s => <span key={s}>{s}</span>)}</div>{category && <div className="match-note"><Sparkles size={14}/>{v.skills.some(s => s.toLowerCase() === category.toLowerCase()) ? `Matches your ${category.toLowerCase()} brief` : 'Related writing skills · review before inviting'}</div>}<button className={`button ${i === 0 && category ? 'primary' : 'secondary'} wide`} disabled={disabled} onClick={() => onSelect(v)}>{disabled ? 'Sending invitation…' : buttonLabel}<ArrowUpRight size={16}/></button><p className="profile-kind">Registered vendor account</p></article>)}</div>; }
function Workroom({ task, vendors, role, busy, act, onBack, onCapture, onCancel }: {
    task: Pact;
    vendors: Vendor[];
    role: Role;
    busy: string;
    act: (action: string, data?: Record<string, unknown> | FormData) => Promise<Pact | undefined>;
    onBack: () => void;
    onCapture: () => void;
    onCancel: () => void;
}) {
    const [tab, setTab] = useState<'conversation' | 'submission'>('conversation');
    const [chat, setChat] = useState('');
    const [submission, setSubmission] = useState(task.submissions.at(-1)?.text || '');
    const [images, setImages] = useState<File[]>([]);
    const [requirements, setRequirements] = useState(task.requirements.map(r => r.text));
    const [showBrief, setShowBrief] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(task.submissions.length);
    const [revisionMode, setRevisionMode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [more, setMore] = useState(false);
    const end = useRef<HTMLDivElement>(null);
    useEffect(() => { setRequirements(task.requirements.map(r => r.text)); setSelectedVersion(task.submissions.length); }, [JSON.stringify(task.requirements), task.submissions.length]);
    const vendor = vendors.find(v => v.id === task.vendorId);
    const done = task.requirements.filter(r => r.status === 'met').length;
    const missing = task.requirements.filter(r => r.status === 'missing').length;
    const unclear = task.requirements.filter(r => r.status === 'clarify').length;
    const closed = ['completed', 'cancelled'].includes(task.stage);
    const viewingEarlier = tab === 'submission' && selectedVersion !== task.submissions.length;
    const drafting = task.stage === 'draft';
    const activeStep = drafting ? 0 : ['matching', 'awaiting_vendor', 'funding'].includes(task.stage) ? 1 : closed ? 3 : 2;
    async function send(e: FormEvent) { e.preventDefault(); if (!chat.trim())
        return; const result = await act(drafting ? 'clarify' : revisionMode ? 'request_revision' : 'chat', { text: chat, role }); if (result) {
        setChat('');
        setRevisionMode(false);
        requestAnimationFrame(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    } }
    const paymentLabel = task.stage === 'cancelled' && ['none', 'created'].includes(task.payment.status) ? 'No payment taken' : { none: 'Not authorized', created: 'Awaiting PayPal approval', authorized: 'Authorized · not charged', captured: 'Payment completed', voided: 'Authorization voided' }[task.payment.status];
    const actionBusy = ['submit', 'review', 'chat', 'clarify', 'request_revision'].includes(busy);
    return <><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Back to my tasks</button><div className="workroom-heading"><div><div className="workroom-kicker"><span>{task.category}</span><span>Agreement v{task.scopeVersion}</span></div><h1>{task.title}</h1><div className="workroom-meta"><Badge tone={task.stage === 'completed' ? 'green' : task.stage === 'cancelled' ? 'neutral' : task.stage === 'revision' ? 'amber' : 'pink'}>{STAGE_LABELS[task.stage]}</Badge><span><Clock3 size={14}/> Due {dateLabel(task.deadline)}</span>{vendor && <span><span className={`avatar tiny ${vendor.color}`}>{vendor.initials}</span>{vendor.name}</span>}</div></div><div className="workroom-heading-actions"><Badge tone="pink">{role === 'client' ? 'Client' : 'Vendor'}</Badge><div className="more-menu"><IconButton label="Task options" onClick={() => setMore(!more)}><MoreHorizontal size={21}/></IconButton>{more && <div className="dropdown"><button onClick={() => { setShowBrief(!showBrief); setMore(false); }}><FileText size={15}/> {showBrief ? 'Hide' : 'View'} original brief</button>{!closed && role === 'client' && <button onClick={() => { setMore(false); onCancel(); }}><X size={15}/> Cancel task</button>}</div>}</div></div></div>
 <div className="task-stepper" aria-label="Task progress">{['Agree on the brief', 'Find your person', 'Make it happen', 'A fair finish'].map((label, i) => <div key={label} className={`${i < activeStep ? 'done' : ''} ${i === activeStep ? 'current' : ''}`}><span>{i < activeStep ? <Check size={13}/> : i + 1}</span><strong>{label}</strong>{i < 3 && <i />}</div>)}</div>
 {showBrief && <div className="original-brief"><h3>The original brief</h3><p>{task.brief}</p><button className="text-button" onClick={() => setShowBrief(false)}>Close brief <X size={13}/></button></div>}
 <div className="perspective-note"><span><Users size={14}/> {role === 'client' ? 'You’re signed in as the client.' : 'You’re signed in as the invited vendor.'}</span><span>Connected AI · {task.payment.mode === 'demo' ? 'simulated payments' : 'PayPal Sandbox'}</span></div>
 {task.stage === 'matching' ? <div className="matching-layout"><div className="next-step-intro"><span className="yellow-icon"><Users size={25}/></span><div><h2>A few people who could help.</h2><p>Matched by registered skill tags. Choose a vendor to review your confirmed brief.</p></div></div><VendorGrid vendors={vendors.filter(v => v.available)} category={task.category} disabled={!!busy} onSelect={v => { void act('select_vendor', { vendorId: v.id }); }}/><p className="fine-print">{vendors.filter(v => v.available).length ? 'Skill matches appear first. Review the profile before inviting.' : 'No vendors are available yet. Ask a teammate to register a vendor account, then refresh.'}</p><div className="matching-agreement"><ShieldCheck size={18}/><span>{task.requirements.length} confirmed requirements · {money(task.budget)} · due {dateLabel(task.deadline)}</span></div></div> : <div className={`workroom-grid ${drafting ? 'drafting' : ''}`}><section className="conversation-panel">
 <div className="workroom-tabs"><button className={tab === 'conversation' ? 'active' : ''} onClick={() => setTab('conversation')}><MessageCircle size={16}/> Conversation</button><button className={tab === 'submission' ? 'active' : ''} onClick={() => setTab('submission')}><FileText size={16}/> The work {task.submissions.length > 0 && <span>{task.submissions.length}</span>}</button><span className="tabs-side"><AgentMark small/> Your AI guide</span></div>
 {task.stage === 'awaiting_vendor' && <div className="next-step-banner"><span className="yellow-icon"><Handshake size={24}/></span><div><h3>{role === 'vendor' ? 'A clear brief, ready for your yes.' : 'An invitation is on its way.'}</h3><p>{role === 'vendor' ? 'Review the checklist, budget, and deadline before accepting.' : 'The vendor can review and accept this invitation in their own account.'}</p>{role === 'vendor' && <button className="button dark" disabled={!!busy} onClick={() => void act('accept_vendor')}>Accept the agreement <Check size={16}/></button>}</div></div>}
 {task.stage === 'funding' && <div className="next-step-banner"><span className="yellow-icon"><Wallet size={24}/></span><div><h3>Both sides are on the same page.</h3><p>{role === 'client' ? 'Authorize the agreed amount before work begins. It will only be captured after acceptance.' : 'The client’s next step is payment authorization. You can begin once they finish that step.'}</p>{role === 'client' && <button className="button dark" disabled={!!busy} onClick={() => void act('authorize')}>{busy === 'authorize' ? <LoaderCircle className="spin" size={16}/> : <ShieldCheck size={16}/>} {task.payment.mode === 'demo' ? `Simulate ${money(task.budget)} authorization` : 'Continue to PayPal Sandbox'}<ArrowUpRight size={15}/></button>}</div></div>}
 {task.stage === 'working' && <div className="next-step-banner compact"><span className="yellow-icon"><FileText size={22}/></span><div><h3>Room to do your best work.</h3><p>{role === 'vendor' ? 'Open “The work” to add your first submission.' : 'Your vendor can submit work from their own account. It will appear here automatically.'}</p>{role === 'vendor' && <button className="text-button" onClick={() => setTab('submission')}>Add your work <ArrowRight size={14}/></button>}</div></div>}
 {task.submissions.length > 0 && task.lastReviewSubmissionId !== task.submissions.at(-1)?.id && !closed && <div className="next-step-banner"><span className="yellow-icon"><RefreshCw size={22}/></span><div><h3>Your work is saved.</h3><p>The latest submission is waiting for a review. You can retry without submitting another version.</p><button className="button secondary" disabled={!!busy} onClick={() => void act('review')}>{busy === 'review' ? <LoaderCircle className="spin" size={15}/> : <RefreshCw size={15}/>} Retry review</button></div></div>}
 {task.stage === 'completed' && <div className="success-banner"><CheckCircle2 size={27}/><div><h3>Good work. A fair finish.</h3><p>The final submission was accepted and {task.payment.mode === 'demo' ? 'the demo payment completed.' : 'PayPal confirmed the sandbox capture.'}</p></div></div>}
 {tab === 'conversation' ? <><div className="messages" aria-live="polite">{task.messages.map(m => <div key={m.id} className={`message ${m.role}`}>
 {m.role === 'system' ? <div className="system-message"><CheckCheck size={14}/><span>{m.text}</span></div> : <><div className="message-avatar">{m.role === 'agent' ? <AgentMark /> : <span className={`avatar ${m.role === 'vendor' ? 'yellow' : 'pink'}`}>{m.role === 'vendor' ? (vendor?.initials || 'V') : initials(task.clientName || 'Client')}</span>}</div><div className="message-content"><div className="message-author"><strong>{m.role === 'agent' ? 'Pact' : m.role === 'vendor' ? (vendor?.name || 'Vendor') : (task.clientName || 'Client')}</strong><span>{m.role === 'agent' ? `${m.agent} agent · ${m.provider === 'gemini' ? 'Gemini' : 'Groq'}` : m.role === 'vendor' ? 'Vendor' : 'Client'}</span></div><div className="message-text">{m.text}</div></div></>}
 </div>)}{actionBusy && <div className="agent-thinking"><AgentMark small/><span>{busy === 'submit' ? 'Reviewing against the agreement' : busy === 'clarify' ? 'Making the brief clearer' : 'Checking the agreement and your question'}<span className="typing-dots">...</span></span></div>}<div ref={end}/></div>
 {!closed && (drafting || ['working', 'revision', 'ready'].includes(task.stage)) && <form className="chat-composer" onSubmit={send}>{revisionMode && <div className="revision-mode"><span>Describe the agreed requirement that needs revision.</span><button type="button" onClick={() => setRevisionMode(false)} aria-label="Exit revision request"><X size={14}/></button></div>}<div className="composer-input"><textarea aria-label={drafting ? 'Clarify your requirements' : 'Ask your AI mediator'} rows={2} maxLength={4000} value={chat} onChange={e => setChat(e.target.value)} placeholder={drafting ? 'Add a detail or answer the guide’s question…' : revisionMode ? 'Which requirement needs another look?' : 'A question, a concern, a little clarification…'} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (chat.trim() && !busy)
                    e.currentTarget.form?.requestSubmit();
            } }}/><button className="send-button" type="submit" disabled={!chat.trim() || !!busy} aria-label="Send message">{actionBusy ? <LoaderCircle className="spin" size={17}/> : <ArrowRight size={20}/>}</button></div><div className="composer-caption"><Sparkles size={12}/><span>{drafting ? 'Your checklist is still a draft. You’ll confirm it before posting.' : 'Every answer stays tied to your confirmed agreement.'}</span></div></form>}
 </> : <div className="submission-panel">{role === 'vendor' && ['working', 'revision'].includes(task.stage) ? <>
 <div className="submission-heading"><div><h3>Your next good draft.</h3><p>Version {task.submissions.length + 1} · your earlier versions stay saved.</p></div><FileText size={24}/></div>
 <label className="submission-label" htmlFor="submission">Your work or a little context</label>
 <textarea id="submission" className="submission-editor" rows={10} maxLength={30000} value={submission} onChange={e => setSubmission(e.target.value)} placeholder="Paste your completed work, or add a note about your images…"/>
 <div className="submission-meta"><span>{submission.match(/\b[\w’'-]+\b/g)?.length || 0} words</span><span>Text, images, or both</span></div>
 <ImagePicker files={images} onChange={setImages} disabled={!!busy}/>
 <button className="button primary wide" disabled={!!busy || (!images.length && submission.trim().length < 40)} onClick={async () => {
     const data = new FormData(); data.set('text', submission); images.forEach(file => data.append('images', file));
     const result = await act('submit', data); if (result) { setImages([]); setTab('conversation'); }
 }}>{busy === 'submit' ? <LoaderCircle className="spin" size={17}/> : <Sparkles size={17}/>} {busy === 'submit' ? 'Reviewing your work…' : 'Submit for a thoughtful review'}</button>
 <p className="form-fine">Only this version is reviewed. Attach the images again for each revision. Submitted versions stay saved.</p>
 {task.submissions.length > 0 && <details className="earlier-work"><summary>View earlier submissions</summary><SubmissionViewer task={task} version={selectedVersion} onVersion={setSelectedVersion}/></details>}
 </> : task.submissions.length ? <SubmissionViewer task={task} version={selectedVersion} onVersion={setSelectedVersion}/> : <div className="empty-state"><FileText size={30}/><h3>Good work takes a little time.</h3><p>The vendor’s submitted work will appear here.</p></div>}</div>}
 </section><aside className="agreement-sidebar"><section className="agreement-card"><div className="agreement-header"><span className="yellow-icon small"><CheckSquare2 size={20}/></span><div><h3>{drafting ? 'Let’s make it clear.' : 'Our shared agreement'}</h3><span>{drafting ? 'Edit before you confirm' : `${done} of ${task.requirements.length} requirements met`}</span></div>{!drafting && <ShieldCheck size={17}/>}</div>{!drafting && <div className="progress-track"><i style={{ width: `${done / task.requirements.length * 100}%` }}/></div>}<div className="requirements-list">{task.requirements.map((r, i) => <div className={`requirement ${r.status}`} key={r.id}><span className="requirement-icon">{r.status === 'met' ? <Check size={13}/> : r.status === 'missing' ? <AlertCircle size={14}/> : r.status === 'clarify' ? <MessageCircle size={13}/> : <span>{i + 1}</span>}</span><div><span className="requirement-id">{r.id}</span>{drafting ? <textarea aria-label={`Edit requirement ${r.id}`} rows={3} value={requirements[i] || ''} maxLength={600} onChange={e => setRequirements(values => values.map((v, n) => n === i ? e.target.value : v))}/> : <p>{r.text}</p>}{r.evidence && <details><summary>{r.status === 'met' ? 'See evidence' : r.status === 'clarify' ? 'Needs your judgment' : 'What needs attention'}</summary><p>{r.evidence}</p>{r.reason && <p>{r.reason}</p>}</details>}</div></div>)}</div>{drafting ? <><div className="agreement-foot"><ShieldCheck size={14}/><span>This becomes the agreement vendors accept.</span></div><button className="button primary wide" disabled={!!busy || requirements.some(r => r.trim().length < 5)} onClick={() => void act('confirm', { requirements })}>Confirm & find talent <ArrowRight size={16}/></button></> : <div className="agreement-foot"><ShieldCheck size={14}/><span>Confirmed scope · changes need both sides’ agreement.</span></div>}</section>
 {task.stage === 'revision' && role === 'client' && missing === 0 && unclear > 0 && <section className="judgment-card"><h3>A little human judgment.</h3><p>{unclear} criterion{unclear === 1 ? ' needs' : 's need'} your review. Read the latest submission before confirming.</p><button className="button secondary wide" disabled={!!busy} onClick={() => void act('confirm_review')}>I’ve checked these criteria <Check size={15}/></button></section>}
 <section className="payment-card"><div className="payment-card-header"><Wallet size={19}/><span>The payment</span><span className="payment-mode">{task.payment.mode === 'demo' ? 'SIMULATED' : 'SANDBOX'}</span></div><div className="payment-amount">{money(task.budget)}<span>USD</span></div><Badge tone={task.payment.status === 'captured' ? 'green' : task.payment.status === 'authorized' ? 'amber' : 'neutral'}>{paymentLabel}</Badge><p>{task.payment.status === 'captured' ? 'A clear agreement. A completed handoff.' : task.payment.status === 'authorized' ? 'Reserved for the agreed work. Captured only after acceptance.' : task.payment.status === 'voided' ? 'The unused authorization was released. No payment was captured.' : task.stage === 'cancelled' ? 'This task ended before payment was authorized.' : 'Both sides agree on the brief before payment authorization.'}</p>{(task.payment.captureId || task.payment.authorizationId) && <button className="transaction-id" title="Copy payment reference" onClick={async () => { try {
            await navigator.clipboard.writeText(task.payment.captureId || task.payment.authorizationId || '');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            setCopied(false);
        } }}><span>{task.payment.captureId || task.payment.authorizationId}</span>{copied ? <Check size={13}/> : <Copy size={13}/>}</button>}
 {task.stage === 'ready' && role === 'client' && <><button className="button primary wide" disabled={!!busy} onClick={() => viewingEarlier ? setSelectedVersion(task.submissions.length) : onCapture()}>{viewingEarlier ? 'View latest submission' : 'Accept & complete'} <CheckCheck size={17}/></button><button className="text-button wide" onClick={() => { setTab('conversation'); setRevisionMode(true); }}>Something needs a revision</button></>}
 {task.stage === 'revision' && role === 'vendor' && <button className="button dark wide" onClick={() => setTab('submission')}>Work on a revision <ArrowRight size={16}/></button>}
 {task.stage === 'ready' && role === 'vendor' && <p className="soft-note"><CheckCircle2 size={15}/> Ready for the client’s acceptance.</p>}
 <div className="payment-fine"><ShieldCheck size={13}/>{task.payment.mode === 'demo' ? 'Demo only. No real money moves.' : 'PayPal test environment. No real money moves.'}</div></section>
 <div className="room-helper"><Flower2 size={24}/><p>Different perspectives.<br /><strong>One shared agreement.</strong></p></div>
 </aside></div>}
 </>;
}
function ImagePicker({ files, onChange, disabled }: { files: File[]; onChange: (files: File[]) => void; disabled: boolean }) {
    const [error, setError] = useState('');
    const [previews, setPreviews] = useState<string[]>([]);
    const input = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const urls = files.map(file => URL.createObjectURL(file));
        setPreviews(urls);
        return () => urls.forEach(url => URL.revokeObjectURL(url));
    }, [files]);
    return <div className="image-picker">
        <div className="image-picker-heading"><button className="button secondary" type="button" disabled={disabled || files.length >= 3} onClick={() => input.current?.click()}><Plus size={16}/> Add images</button><span>PNG or JPG · up to 3 · 2 MB each</span></div>
        <input ref={input} type="file" accept="image/png,image/jpeg" multiple hidden aria-label="Attach submission images" onChange={e => {
            const added = Array.from(e.target.files || []); e.target.value = '';
            const next = [...files, ...added];
            if (next.length > 3) return setError('Choose up to 3 images for this version.');
            if (added.some(file => !['image/png', 'image/jpeg'].includes(file.type))) return setError('Please choose PNG or JPG images.');
            if (added.some(file => !file.size || file.size > 2 * 1024 * 1024)) return setError('Each image must be no larger than 2 MB.');
            setError(''); onChange(next);
        }}/>
        {error && <p className="upload-error" role="alert">{error}</p>}
        {!!files.length && <div className="image-previews">{files.map((file, i) => <figure key={`${file.name}-${i}`}><img src={previews[i]} alt={file.name}/><button type="button" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => { setError(''); onChange(files.filter((_, n) => n !== i)); }}><X size={14}/></button><figcaption>{file.name}</figcaption></figure>)}</div>}
        <p className="image-review-note">Submitted images are shared with the client and sent to your connected AI for review.</p>
    </div>;
}
function SubmissionViewer({ task, version, onVersion }: { task: Pact; version: number; onVersion: (version: number) => void }) {
    const submission = task.submissions.find(s => s.version === version) || task.submissions.at(-1);
    if (!submission) return null;
    return <>
        <div className="submission-heading"><div><h3>The work, so far.</h3><p>Your full submission history, in one place.</p></div><select aria-label="Submission version" value={submission.version} onChange={e => onVersion(Number(e.target.value))}>{task.submissions.map(s => <option key={s.id} value={s.version}>Version {s.version}{s.version === task.submissions.length ? ' · Latest' : ''}</option>)}</select></div>
        {submission.version !== task.submissions.length && <p className="version-note">You’re viewing an earlier version. The checklist reflects the latest submission.</p>}
        {submission.text && <article className="submitted-document">{submission.text}</article>}
        {!!submission.images?.length && <div className="submitted-images">{submission.images.map(image => <figure key={image.id}><a href={`/api/tasks/${task.id}/images/${image.id}`} target="_blank" rel="noreferrer" aria-label={`Open ${image.name}`}><img src={`/api/tasks/${task.id}/images/${image.id}`} alt={image.name} loading="lazy"/></a><figcaption><strong>{image.name}</strong><span>{image.width} × {image.height} · Open full image <ArrowUpRight size={12}/></span></figcaption></figure>)}</div>}
    </>;
}
function VendorForm({ vendor, busy, onClose, onSave }: { vendor?: Vendor; busy: boolean; onClose: () => void; onSave: (data: unknown) => Promise<void> }) {
    const [title, setTitle] = useState(vendor?.title || ''); const [bio, setBio] = useState(vendor?.bio || ''); const [skills, setSkills] = useState(vendor?.skills.join(', ') || ''); const [available, setAvailable] = useState(vendor?.available ?? true);
    return <Modal title="Your skills, in your words." onClose={onClose}><p className="modal-description">Your profile is linked to your vendor account and visible to clients.</p><form className="task-form" onSubmit={e => { e.preventDefault(); void onSave({ title, bio, skills: skills.split(',').map(s => s.trim()).filter(Boolean), available }); }}><label>Your introduction<input required minLength={5} maxLength={100} value={title} onChange={e => setTitle(e.target.value)}/></label><label>About your work<textarea required minLength={15} maxLength={500} rows={4} value={bio} onChange={e => setBio(e.target.value)}/></label><label>Your skills<span className="label-hint">Separate skills with commas.</span><input required maxLength={250} value={skills} onChange={e => setSkills(e.target.value)}/></label><label className="checkbox-label"><input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)}/><span>Available for new tasks</span></label><button className="button primary wide" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Check size={16}/>} Save my profile</button></form></Modal>;
}
function Help({ client, onStart }: { client: boolean; onStart: () => void }) {
    const steps = [{ icon: MessageCircle, title: 'Start with a conversation.', body: 'The client describes the task. The Requirements agent asks about unclear details and creates an editable checklist. The client confirms it before inviting a vendor.' }, { icon: Users, title: 'Find someone on your wavelength.', body: 'Registered vendors appear by skill match. The selected vendor receives the invitation in their own account and accepts the scope, budget, and deadline.' }, { icon: Sparkles, title: 'Make room for thoughtful feedback.', body: 'The vendor submits text, images, or both. The Review agent checks the latest version against the agreed requirements. Both participants can ask the Mediation agent questions and request explanations.' }, { icon: Handshake, title: 'Finish on the same page.', body: 'The client reviews uncertain criteria, asks for revisions when agreed work is missing, and accepts the latest submission. The payment step uses PayPal Sandbox when connected, or a clearly labelled simulation otherwise.' }];
    return <div className="help-page"><div className="help-heading"><span className="hero-tag"><Flower2 size={15}/> A fairer way to work</span><h1>Good things happen<br />when we understand<br /><span className="pink-text">each other.</span></h1><p>Separate accounts. A shared agreement. Three AI specialists to help keep expectations clear.</p></div><div className="help-steps">{steps.map(({ icon: Icon, title, body }, i) => <section key={title}><div className={`help-step-icon ${i % 2 ? 'yellow' : 'pink'}`}><Icon size={26}/></div><div><span className="eyebrow">0{i + 1}</span><h2>{title}</h2><p>{body}</p></div></section>)}</div><div className="help-bottom"><div><h2>Three specialists. One shared brief.</h2><p>The server routes requests to Requirements, Review, and Mediation agents. The confirmed agreement stays the source of scope, and payment actions stay under server control.</p></div><button className="button dark" onClick={onStart}>{client ? 'Create a task' : 'My tasks'}<ArrowRight size={17}/></button></div><p className="fine-print">AI findings can be questioned. Pact explains the recorded agreement and does not claim to know unspoken intentions.</p></div>;
}
function Connections({ config, user, onRefresh, onLogout }: { config: Configuration; user: Workspace['user']; onRefresh: () => void; onLogout: () => void }) {
    return <div className="connections-page"><div className="page-heading"><div><p className="eyebrow">YOUR SPACE FOR GOOD WORK</p><h1>Behind the good work<span className="greeting-dot">.</span></h1><p>Your account and connections, without the guesswork.</p></div><button className="button secondary" onClick={onRefresh}><RefreshCw size={16}/> Refresh</button></div><div className="connection-list"><section><span className="connection-icon pink"><Users size={24}/></span><div><h2>{user.name}</h2><p>{user.email}<br />{user.role === 'client' ? 'Client' : 'Vendor'} account · your role is verified on the server.</p></div><Badge tone="green">Signed in</Badge></section><section><span className="connection-icon yellow"><Sparkles size={24}/></span><div><h2>Your AI team</h2><p>{config.ai.connected ? `${config.ai.primary} powers your three specialist agents.${config.ai.backup ? ' Groq is available as backup.' : ''}` : 'Connect an AI provider on the server to create and review work.'}</p></div><Badge tone={config.ai.connected ? 'green' : 'amber'}>{config.ai.connected ? 'Connected' : 'Not connected'}</Badge></section><section><span className="connection-icon lavender"><Wallet size={24}/></span><div><h2>The payment</h2><p>{config.paypal.connected ? 'PayPal Sandbox credentials are configured for new tasks.' : 'Authorization and completion are simulated. No money moves.'}</p></div><Badge tone="amber">{config.paypal.connected ? 'Sandbox' : 'Simulated'}</Badge></section><section><span className="connection-icon pink"><BriefcaseBusiness size={24}/></span><div><h2>Your shared workspace</h2><p>Agreements, invitations, messages, profiles, and submission versions are saved. Task access is limited to the client and their invited vendor.</p></div><Badge tone="green">Saved locally</Badge></section></div><div className="account-row"><span className="avatar pink">{initials(user.name)}</span><div><strong>Your account, your actions.</strong><p>Sign in separately to use another account.</p></div><button className="text-button" onClick={onLogout}>Sign out <ArrowUpRight size={15}/></button></div></div>;
}
