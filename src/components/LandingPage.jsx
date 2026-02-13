import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import './LandingPage.css';

/* ────────── Intersection Observer hook ────────── */
function useReveal() {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.classList.add('visible');
                    observer.unobserve(el);
                }
            },
            { threshold: 0.15 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return ref;
}

function Reveal({ className = '', delay = 0, children }) {
    const ref = useReveal();
    const delayClass = delay ? `lp-delay-${delay}` : '';
    return (
        <div ref={ref} className={`lp-fade-in ${delayClass} ${className}`}>
            {children}
        </div>
    );
}

/* ────────── FAQ Accordion Item ────────── */
function FaqItem({ question, answer }) {
    const [open, setOpen] = useState(false);
    return (
        <div className={`lp-faq-item ${open ? 'open' : ''}`}>
            <button className="lp-faq-q" onClick={() => setOpen(!open)}>
                {question}
                <span className="lp-faq-chevron">▼</span>
            </button>
            <div className="lp-faq-a">
                <p>{answer}</p>
            </div>
        </div>
    );
}

/* ────────── Main Landing Page ────────── */
export default function LandingPage() {
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="landing">
            {/* Animated background grid */}
            <div className="landing-bg" />

            {/* ── Navbar ── */}
            <nav className="lp-nav">
                <div className="lp-nav-inner">
                    <a href="#hero" className="lp-logo">
                        🚗 <span>Cajurona</span>
                    </a>

                    <button
                        className="lp-nav-toggle"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Menu"
                    >
                        {menuOpen ? '✕' : '☰'}
                    </button>

                    <ul className={`lp-nav-links ${menuOpen ? 'open' : ''}`}>
                        <li><a href="#problema" onClick={() => setMenuOpen(false)}>Problema</a></li>
                        <li><a href="#pilares" onClick={() => setMenuOpen(false)}>Diferenciais</a></li>
                        <li><a href="#como-funciona" onClick={() => setMenuOpen(false)}>Como Funciona?</a></li>
                        <li><a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a></li>
                        <li className="lp-mobile-cta">
                            <Link to="/login" className="lp-btn lp-btn-ghost" onClick={() => setMenuOpen(false)}>
                                Entrar
                            </Link>
                            <Link to="/cadastro" className="lp-btn lp-btn-primary" onClick={() => setMenuOpen(false)}>
                                Cadastre-se
                            </Link>
                        </li>
                    </ul>

                    <div className="lp-nav-cta">
                        {user ? (
                            <Link to={user.grupoId ? (user.isMotorista ? `/admin/${user.grupoId}` : `/g/${user.grupoId}`) : '/grupos'} className="lp-btn lp-btn-primary">
                                📊 Meu Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link to="/login" className="lp-btn lp-btn-ghost">Entrar</Link>
                                <Link to="/cadastro" className="lp-btn lp-btn-primary">Cadastre-se</Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* ══════════ HERO ══════════ */}
            <section id="hero" className="lp-section lp-hero">
                <Reveal>
                    <div className="lp-hero-badge">
                        ⚡ Baseado em Pesquisa Científica
                    </div>
                </Reveal>

                <Reveal delay={1}>
                    <h1 className="lp-section-title">
                        A Próxima Geração da Mobilidade Urbana:{' '}
                        <span className="lp-gradient-text">Segura, Justa e Descentralizada.</span>
                    </h1>
                </Reveal>

                <Reveal delay={2}>
                    <p className="lp-section-subtitle">
                        Divida custos de forma justa, viaje com pessoas confiáveis e tenha
                        controle total sobre seus dados. A plataforma de caronas que coloca
                        você — e não um algoritmo — no centro da decisão.
                    </p>
                </Reveal>

                <Reveal delay={3}>
                    <div className="lp-hero-cta">
                        <Link to="/cadastro" className="lp-btn lp-btn-primary lp-btn-lg">
                            🚀 Junte-se à Rede
                        </Link>
                        <a href="#pilares" className="lp-btn lp-btn-ghost lp-btn-lg">
                            Saiba Mais ↓
                        </a>
                    </div>
                </Reveal>

                <Reveal delay={4}>
                    <div className="lp-stats">
                        <div className="lp-stat">
                            <div className="lp-stat-value">÷</div>
                            <div className="lp-stat-label">Rateio de custos real</div>
                        </div>
                        <div className="lp-stat">
                            <div className="lp-stat-value">100%</div>
                            <div className="lp-stat-label">Rateio justo e transparente</div>
                        </div>
                        <div className="lp-stat">
                            <div className="lp-stat-value">🔒</div>
                            <div className="lp-stat-label">Seus dados, suas regras</div>
                        </div>
                    </div>
                </Reveal>
            </section>

            {/* ══════════ PROBLEMA ══════════ */}
            <section id="problema" className="lp-section lp-problem">
                <div className="lp-section-inner">
                    <Reveal>
                        <div className="lp-section-label">O Problema</div>
                        <h2 className="lp-section-title">
                            Por que a mobilidade urbana <span className="lp-gradient-text">precisa mudar?</span>
                        </h2>
                        <p className="lp-section-subtitle">
                            Carros circulam quase vazios, os custos só sobem e você não sabe
                            como o preço da sua corrida é calculado. Isso precisa mudar.
                        </p>
                    </Reveal>

                    <div className="lp-problem-grid">
                        <Reveal delay={1}>
                            <div className="lp-problem-card">
                                <div className="lp-problem-icon">🌍</div>
                                <h3>Carros vazios, cidades cheias</h3>
                                <p>
                                    A maioria dos carros nas ruas leva apenas uma pessoa. Resultado:
                                    mais trânsito, mais poluição e mais dinheiro gasto por todos.
                                </p>
                            </div>
                        </Reveal>
                        <Reveal delay={2}>
                            <div className="lp-problem-card">
                                <div className="lp-problem-icon">🔒</div>
                                <h3>Medo de pegar carona</h3>
                                <p>
                                    Quem nunca pensou duas vezes antes de dividir um carro com
                                    desconhecidos? Sem verificação real de identidade e reputação,
                                    a confiança simplesmente não existe.
                                </p>
                            </div>
                        </Reveal>
                        <Reveal delay={3}>
                            <div className="lp-problem-card">
                                <div className="lp-problem-icon">🕵️</div>
                                <h3>Você não sabe quanto paga</h3>
                                <p>
                                    Apps de corrida cobram taxas ocultas e alteram preços com
                                    "demanda dinâmica". Você nunca sabe exatamente para onde
                                    vai o seu dinheiro.
                                </p>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ══════════ PILARES / DIFERENCIAIS ══════════ */}
            <section id="pilares" className="lp-section">
                <div className="lp-section-inner">
                    <Reveal>
                        <div className="lp-section-label">Nossos Diferenciais</div>
                        <h2 className="lp-section-title">
                            Os três pilares de uma <span className="lp-gradient-text">mobilidade justa</span>
                        </h2>
                        <p className="lp-section-subtitle">
                            Tecnologia de ponta a serviço de quem realmente importa: você.
                            Cada recurso foi desenhado para resolver problemas reais.
                        </p>
                    </Reveal>

                    <div className="lp-pillars-grid">
                        <Reveal delay={1}>
                            <div className="lp-pillar-card">
                                <div className="lp-pillar-icon">🛡️</div>
                                <h3>Segurança e Verificação</h3>
                                <p>
                                    Todos os usuários passam por verificação de identidade.
                                    Seus dados pessoais ficam protegidos e só são
                                    compartilhados com quem você autoriza.
                                </p>
                                <span className="lp-pillar-tag">Usuários verificados</span>
                            </div>
                        </Reveal>
                        <Reveal delay={2}>
                            <div className="lp-pillar-card">
                                <div className="lp-pillar-icon">⚖️</div>
                                <h3>Rateio Justo</h3>
                                <p>
                                    O valor de manutenção (combustível, pedágio e outros custos)
                                    é dividido proporcionalmente entre os participantes.
                                    Sem lucro, apenas economia mútua.
                                </p>
                                <span className="lp-pillar-tag">Divisão matemática e transparente</span>
                            </div>
                        </Reveal>
                        <Reveal delay={3}>
                            <div className="lp-pillar-card">
                                <div className="lp-pillar-icon">🤝</div>
                                <h3>Comunidade e Grupos</h3>
                                <p>
                                    Crie ou entre em grupos de carona recorrente com pessoas
                                    da sua universidade. Mais segurança e integração com quem
                                    estuda no mesmo lugar que você.
                                </p>
                                <span className="lp-pillar-tag">Caronas universitárias</span>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ══════════ COMO FUNCIONA ══════════ */}
            <section id="como-funciona" className="lp-section lp-how">
                <div className="lp-section-inner">
                    <Reveal>
                        <div className="lp-section-label" style={{ textAlign: 'center' }}>Simples de usar</div>
                        <h2 className="lp-section-title" style={{ textAlign: 'center' }}>
                            Como <span className="lp-gradient-text">funciona</span>
                        </h2>
                        <p className="lp-section-subtitle" style={{ textAlign: 'center', margin: '0 auto' }}>
                            Em poucos passos, você já está economizando e viajando com
                            segurança.
                        </p>
                    </Reveal>

                    <div className="lp-how-steps">
                        <Reveal delay={1}>
                            <div className="lp-step">
                                <div className="lp-step-number">1</div>
                                <div className="lp-step-icon">🔐</div>
                                <h3>Crie sua conta</h3>
                                <p>
                                    Cadastre-se em segundos com seu telefone.
                                    Rápido, simples e seguro.
                                </p>
                            </div>
                        </Reveal>
                        <Reveal delay={2}>
                            <div className="lp-step">
                                <div className="lp-step-number">2</div>
                                <div className="lp-step-icon">🎯</div>
                                <h3>Encontre sua carona ideal</h3>
                                <p>
                                    O sistema encontra caronas compatíveis com suas preferências:
                                    horário, trajeto, e até estilo de viagem (silêncio ou
                                    conversa, música ou podcast).
                                </p>
                            </div>
                        </Reveal>
                        <Reveal delay={3}>
                            <div className="lp-step">
                                <div className="lp-step-number">3</div>
                                <div className="lp-step-icon">💰</div>
                                <h3>Pague apenas o justo</h3>
                                <p>
                                    Ao final da viagem, os custos de manutenção (gasolina, pedágio)
                                    são somados e divididos entre os participantes.
                                    Transparência total no rateio.
                                </p>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ══════════ FAQ ══════════ */}
            <section id="faq" className="lp-section">
                <div className="lp-section-inner">
                    <Reveal>
                        <div className="lp-section-label" style={{ textAlign: 'center' }}>Dúvidas Frequentes</div>
                        <h2 className="lp-section-title" style={{ textAlign: 'center' }}>
                            Tire suas <span className="lp-gradient-text">dúvidas</span>
                        </h2>
                    </Reveal>

                    <Reveal delay={1}>
                        <div className="lp-faq-list">
                            <FaqItem
                                question="O que torna o Cajurona diferente do Uber?"
                                answer="O Cajurona é carona de verdade — não um serviço de corrida. Aqui, motorista e passageiros dividem os custos reais da viagem (combustível, pedágio, etc.) por meio de um rateio justo. Você paga apenas a sua parte proporcional e todo mundo economiza."
                            />
                            <FaqItem
                                question="Meus dados estão seguros?"
                                answer="Sim. Seus dados pessoais são armazenados de forma segura e só são visíveis para os membros do grupo de carona que você escolher. Não compartilhamos suas informações com terceiros e você tem controle sobre o que é exibido no seu perfil."
                            />
                            <FaqItem
                                question="Como funciona o rateio de custos?"
                                answer="O custo total de manutenção da viagem (como gasolina, pedágios e desgaste) é somado e dividido entre os participantes. Quem usa mais trecho, paga proporcionalmente mais. O valor final é definido com base nesses custos reais."
                            />

                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ══════════ CTA FINAL ══════════ */}
            <section className="lp-section lp-cta-section">
                <Reveal>
                    <div className="lp-cta-card">
                        <h2>
                            Seja parte da revolução da{' '}
                            <span className="lp-gradient-text">mobilidade justa</span>.
                        </h2>
                        <p>
                            Economize dinheiro, reduza seu impacto ambiental e viaje com
                            segurança. A mobilidade do futuro começa agora.
                        </p>
                        <Link to="/cadastro" className="lp-btn lp-btn-primary lp-btn-lg">
                            🚀 Junte-se à Rede
                        </Link>
                    </div>
                </Reveal>
            </section>

            {/* ══════════ FOOTER ══════════ */}
            <footer className="lp-footer">
                <p>
                    Cajurona © {new Date().getFullYear()} · Fundamentado no estudo{' '}
                    <em>"Mapeamento Sistemático de Aplicativos de Carona com Autenticação de Usuários e Rateio de Custos"</em>.
                </p>
            </footer>
        </div>
    );
}
