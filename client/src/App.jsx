
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Wallet,
  CheckCircle2,
  Send,
  Menu,
  X,
  GraduationCap,
  HandHeart,
} from 'lucide-react';

const API = (
  import.meta.env.VITE_API_URL || 'http://localhost:8787'
).replace(/\/+$/, '');

const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || '';
const paypalEnvironment = import.meta.env.VITE_PAYPAL_ENV || 'unconfigured';
const isSandbox = paypalEnvironment === 'sandbox';
console.log('PayPal environment:', JSON.stringify(paypalEnvironment));
console.log('PayPal Client ID loaded:', Boolean(paypalClientId));

const initiatives = [
  {
    id: 'school-kits',
    category: 'Education',
    title: 'School Essentials for Every Child',
    description:
      'Help provide learning materials such as exercise books, pencils and school bags for children who need them.',
    amount: 25,
    raised: 3725,
    goal: 6000,
    icon: 'education',
    tag: 'Learning',
    impact: 'Illustrative estimate: helps fund school essentials for a learner.',
  },
  {
    id: 'women-skills',
    category: 'Livelihoods',
    title: 'Skills for Women & Youth',
    description:
      'Support practical skills training that can help participants explore sustainable income opportunities.',
    amount: 40,
    raised: 2460,
    goal: 5000,
    icon: 'people',
    tag: 'Opportunity',
    impact:
      'Illustrative estimate: contributes to training materials and practice sessions.',
  },
  {
    id: 'community-health',
    category: 'Healthcare',
    title: 'Community Health Access',
    description:
      'Help community teams share basic health education and connect people with local support.',
    amount: 30,
    raised: 3180,
    goal: 7000,
    icon: 'health',
    tag: 'Wellbeing',
    impact:
      'Illustrative estimate: contributes to outreach and health education resources.',
  },
];

const money = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

function IconFor({ name, size = 23 }) {
  const Icon =
    name === 'education'
      ? GraduationCap
      : name === 'people'
        ? Users
        : Stethoscope;

  return <Icon size={size} />;
}

export default function App() {
  const [selected, setSelected] = useState(initiatives[0]);
  const [amount, setAmount] = useState(25);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [payments, setPayments] = useState([]);
  const [health, setHealth] = useState('checking');

  const totalRaised = useMemo(
    () => initiatives.reduce((total, item) => total + item.raised, 0),
    []
  );

  // Check whether the backend API is available.
  useEffect(() => {
    let active = true;

    fetch(`${API}/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('API health check failed');
        }
        return response.json();
      })
      .then(() => {
        if (active) setHealth('online');
      })
      .catch(() => {
        if (active) setHealth('offline');
      });

    return () => {
      active = false;
    };
  }, []);


  // Load the PayPal JavaScript SDK for the configured environment.
    

  useEffect(() => {
    if (
      !paypalClientId ||
      !['sandbox', 'live'].includes(paypalEnvironment)
    ) {
      setPaypalReady(false);
      return;
    }

    const existingScript = document.getElementById('paypal-sdk');

    if (existingScript) {
      if (window.paypal) {
        setPaypalReady(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'paypal-sdk';
    script.src =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
        paypalClientId
      )}&currency=USD&intent=capture`;

    script.onload = () => setPaypalReady(true);

    script.onerror = () => {
      setPaypalReady(false);
      setNotice(
        'PayPal could not load. Check the PayPal Client ID and your network connection.'
      );
    };


    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [paypalEnvironment, paypalClientId]);

  // Ask the AI endpoint, with a local fallback if it is unavailable.
  async function askAI(event) {
    event?.preventDefault();

    const message = question.trim();
    if (!message || chatBusy) return;

    setChatBusy(true);
    setAnswer('');

    try {
      const response = await fetch(`${API}/api/assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          initiatives,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Assistant request failed');
      }

      setAnswer(
        data.answer ||
        'I could not generate an answer just now. Please try again.'
      );
    } catch {
      const lowerQuestion = message.toLowerCase();

      const match = initiatives.find(
        (item) =>
          lowerQuestion.includes(item.category.toLowerCase()) ||
          item.title
            .toLowerCase()
            .split(' ')
            .some(
              (word) =>
                word.length > 5 && lowerQuestion.includes(word)
            )
      );

      const best = match || initiatives[0];

      setAnswer(
        `Based on the sample initiative information, you could explore "${best.title}". ${best.description} A ${money(best.amount)} example contribution is shown as a planning guide only. The funding figures and impact estimates are illustrative and should be verified with the organizer.`
      );
    } finally {
      setChatBusy(false);
    }
  }

  // Ask the backend to create a PayPal Sandbox order.
  async function createOrder() {
    const response = await fetch(`${API}/api/paypal/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(amount),
        initiativeId: selected.id,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.id) {
      throw new Error(data.error || 'Could not create PayPal order');
    }

    return data.id;
  }

  // Ask the backend to capture and verify the approved Sandbox order.
  async function captureOrder(orderID) {
    const response = await fetch(`${API}/api/paypal/capture-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderID,
        initiativeId: selected.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Could not verify payment');
    }

    if (data.status !== 'COMPLETED') {
      throw new Error(
        `PayPal returned status: ${data.status || 'unknown'}`
      );
    }

    setPayments((previous) =>
      [
        {
          id: orderID,
          amount,
          initiative: selected.title,
          status: 'Sandbox payment completed',
        },
        ...previous,
      ].slice(0, 4)
    );

    setPaymentStatus(
      `Sandbox payment completed for ${money(amount)}. This is a test transaction, not a real donation.`
    );
  }

  // Start the PayPal Sandbox checkout.
  async function startPayPal() {
    setNotice('');
    setPaymentStatus('');

    if (!['sandbox', 'live'].includes(paypalEnvironment)) {
      setNotice('PayPal checkout is disabled. Configure a valid PayPal environment first.');
      return;
    }


    if (!paypalClientId) {
      setNotice(

        'PayPal Client ID is missing. Check VITE_PAYPAL_CLIENT_ID in client/.env.'

      );
      return;
    }

    if (!paypalReady || !window.paypal) {
      setNotice(
        'PayPal is loading or unavailable. Please wait and try again.'
      );
      return;
    }

    const container = document.getElementById('paypal-buttons');

    if (!container) {
      setNotice('The PayPal checkout area could not be found.');
      return;
    }

    container.innerHTML = '';
    setPaymentBusy(true);

    try {
      await window.paypal
        .Buttons({
          style: {
            layout: 'vertical',
            shape: 'rect',
            label: 'paypal',
          },

          createOrder: async () => {
            try {
              return await createOrder();
            } catch (error) {
              setNotice(
                error.message || 'Could not create PayPal order.'
              );
              throw error;
            }
          },

          onApprove: async (data) => {
            try {
              await captureOrder(data.orderID);
            } catch (error) {
              setNotice(
                error.message || 'Could not verify payment.'
              );
            } finally {
              setPaymentBusy(false);
            }
          },

          onCancel: () => {
            setPaymentStatus(
              'Checkout was cancelled. No payment was captured.'
            );
            setPaymentBusy(false);
          },

          onError: (error) => {
            setNotice(
              error?.message || 'PayPal checkout failed.'
            );
            setPaymentBusy(false);
          },
        })
        .render('#paypal-buttons');
    } catch {
      setNotice('Could not display PayPal checkout. Please try again.');
      setPaymentBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="#home" className="brand">
          <span className="brand-mark">
            <HandHeart size={23} />
          </span>
          <span>
            impactbridge<span className="brand-ai">AI</span>
          </span>
        </a>

        <nav className={menuOpen ? 'nav nav-open' : 'nav'}>
          <a href="#initiatives" onClick={() => setMenuOpen(false)}>
            Explore initiatives
          </a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
            How it works
          </a>
          <a href="#assistant" onClick={() => setMenuOpen(false)}>
            AI guide
          </a>
          <a
            className="nav-cta"
            href="#give"
            onClick={() => setMenuOpen(false)}
          >
            Make an impact <ArrowUpRight size={16} />
          </a>
        </nav>

        <button
          className="mobile-menu"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main id="home">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse" /> TECHNOLOGY FOR GOOD
            </div>

            <h1>
              Give with purpose.
              <br />
              <span>See the possibility.</span>
            </h1>

            <p className="hero-lede">
              Discover community initiatives, get guidance from AI, and
              explore a clearer path from generosity to impact.
            </p>

            <div className="hero-actions">
              <a className="btn btn-primary" href="#initiatives">
                Explore initiatives <ArrowRight size={17} />
              </a>
              <a className="text-link" href="#how-it-works">
                How it works <ArrowUpRight size={16} />
              </a>
            </div>

            <div className="trust-row">
              <span>
                <ShieldCheck size={17} /> PayPal Sandbox
              </span>
              <span>
                <Sparkles size={17} /> AI-assisted discovery
              </span>
            </div>
          </div>

          <div
            className="hero-art"
            aria-label="Illustration of community impact"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />

            <div className="art-center">
              <div className="art-heart">
                <HeartHandshake size={57} />
              </div>
              <span>
                Small acts.
                <br />
                Shared progress.
              </span>
            </div>

            <div className="float-card float-card-top">
              <span className="float-icon mint">
                <BookOpen size={19} />
              </span>
              <div>
                <b>Learning</b>
                <small>More opportunity</small>
              </div>
              <CheckCircle2 className="check" size={18} />
            </div>

            <div className="float-card float-card-bottom">
              <span className="float-icon peach">
                <Users size={19} />
              </span>
              <div>
                <b>Community</b>
                <small>People-powered change</small>
              </div>
            </div>

            <div className="spark spark-a">✳</div>
            <div className="spark spark-b">✦</div>
          </div>
        </section>

        <section className="stats section-wrap">
          <div>
            <strong>{String(initiatives.length).padStart(2, '0')}</strong>
            <span>Community initiatives</span>
          </div>
          <div>
            <strong>{money(totalRaised)}</strong>
            <span>Illustrative funding progress</span>
          </div>
          <div>
            <strong>One</strong>
            <span>More informed giving journey</span>
          </div>
          <div className="api-status">
            <span
              className={
                health === 'online'
                  ? 'status-dot'
                  : 'status-dot status-warn'
              }
            />
            <span>
              API{' '}
              {health === 'online'
                ? 'connected'
                : health === 'checking'
                  ? 'checking'
                  : 'offline demo mode'}
            </span>
          </div>
        </section>

        <section
          id="initiatives"
          className="section-wrap section-block"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">WHERE GOOD CAN GROW</div>
              <h2>
                Find a cause that <span>moves you.</span>
              </h2>
            </div>
            <p>
              Explore sample initiatives and see how a contribution
              could support a community goal.
            </p>
          </div>

          <div className="initiative-grid">
            {initiatives.map((item, index) => (
              <article
                className={
                  'initiative-card ' +
                  (selected.id === item.id ? 'selected-card' : '')
                }
                key={item.id}
              >
                <div className={`initiative-visual visual-${index}`}>
                  <span className="initiative-icon">
                    <IconFor name={item.icon} size={28} />
                  </span>
                  <span className="tag">{item.tag}</span>
                  <div className="visual-decoration">
                    {index === 0
                      ? 'LEARN'
                      : index === 1
                        ? 'GROW'
                        : 'CARE'}
                  </div>
                </div>

                <div className="initiative-content">
                  <span className="category">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>

                  <div className="progress-label">
                    <span>Illustrative progress</span>
                    <b>
                      {Math.round((item.raised / item.goal) * 100)}%
                    </b>
                  </div>

                  <div className="progress-track">
                    <span
                      style={{
                        width: `${Math.min(
                          100,
                          (item.raised / item.goal) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="card-foot">
                    <span>
                      <b>{money(item.raised)}</b> of {money(item.goal)}
                    </span>
                    <button
                      onClick={() => {
                        setSelected(item);
                        setAmount(item.amount);
                        setNotice('');
                        setPaymentStatus('');
                        document
                          .getElementById('give')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="round-arrow"
                      aria-label={`Choose ${item.title}`}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="disclaimer">
            Demo content: initiative totals, goals and impact estimates
            are illustrative examples, not verified fundraising data.
          </p>
        </section>

        <section id="assistant" className="assistant-section">
          <div className="section-wrap assistant-layout">
            <div className="assistant-intro">
              <div className="eyebrow light-eyebrow">
                <Sparkles size={15} /> YOUR AI GIVING GUIDE
              </div>
              <h2>
                Good questions lead
                <br />
                to <span>better giving.</span>
              </h2>
              <p>
                Tell the guide what matters to you. It can help you
                explore the initiative information and compare options
                without inventing verified outcomes.
              </p>

              <div className="prompt-chips">
                <button
                  onClick={() =>
                    setQuestion(
                      'I want to support education. What should I explore?'
                    )
                  }
                >
                  Support education
                </button>
                <button
                  onClick={() =>
                    setQuestion(
                      'Compare the initiatives for a small contribution.'
                    )
                  }
                >
                  Compare initiatives
                </button>
              </div>
            </div>

            <div className="chat-card">
              <div className="chat-head">
                <div className="assistant-avatar">
                  <Sparkles size={20} />
                </div>
                <div>
                  <b>ImpactBridge guide</b>
                  <small>
                    <span className="status-dot" /> Available to help
                  </small>
                </div>
                <span className="ai-pill">AI GUIDE</span>
              </div>

              <div className="chat-body">
                <div className="chat-message bot-message">
                  Hi there! What kind of community impact would you like
                  to explore today?
                </div>

                {answer && (
                  <div className="chat-message bot-message answer-message">
                    {answer}
                  </div>
                )}

                {chatBusy && (
                  <div className="chat-message bot-message">
                    Thinking through the options…
                  </div>
                )}
              </div>

              <form className="chat-form" onSubmit={askAI}>
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about an initiative…"
                  aria-label="Ask the AI giving guide"
                />
                <button
                  type="submit"
                  disabled={chatBusy || !question.trim()}
                  aria-label="Send question"
                >
                  <Send size={18} />
                </button>
              </form>

              <div className="chat-foot">
                Guidance is informational; verify initiative details
                before contributing.
              </div>
            </div>
          </div>
        </section>

        <section id="give" className="section-wrap give-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">YOUR NEXT STEP</div>
              <h2>
                Make giving <span>intentional.</span>
              </h2>
            </div>
            <p>
              Choose a sample initiative and amount, then test the
              payment journey with PayPal Sandbox.
            </p>
          </div>

          <div className="give-layout">
            <div className="give-form-card">
              <div className="selected-cause">
                <span className="selected-cause-icon">
                  <IconFor name={selected.icon} />
                </span>
                <div>
                  <small>Selected initiative</small>
                  <b>{selected.title}</b>
                  <span>{selected.category}</span>
                </div>
              </div>

              <div className="form-label">Choose a test contribution</div>

              <div className="amount-options">
                {[10, 25, 50, 100].map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={
                      amount === value ? 'amount-active' : ''
                    }
                    onClick={() => setAmount(value)}
                  >
                    {money(value)}
                  </button>
                ))}
              </div>

              <label className="form-label" htmlFor="custom-amount">
                Or enter an amount (USD)
              </label>

              <div className="amount-input">
                <span>$</span>
                <input
                  id="custom-amount"
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      Math.max(
                        1,
                        Math.min(10000, Number(event.target.value) || 1)
                      )
                    )
                  }
                />
                <span>USD</span>
              </div>

              <div className="summary-line">
                <span>Test contribution</span>
                <b>{money(amount)}</b>
              </div>

              <button
                type="button"
                className="btn btn-primary pay-start"
                onClick={startPayPal}
                disabled={paymentBusy}
              >
                <Wallet size={18} />
                {paymentBusy
                  ? 'Checkout in progress'
                  : 'Continue with PayPal'}
              </button>

              <div id="paypal-buttons" className="paypal-buttons" />

              {notice && (
                <div className="notice notice-warn" role="alert">
                  {notice}
                </div>
              )}

              {paymentStatus && (
                <div className="notice notice-success" role="status">
                  <CheckCircle2 size={18} />
                  {paymentStatus}
                </div>
              )}

              <div className="secure-note">
                <ShieldCheck size={16} />
                Sandbox testing only. No real funds should be transferred.
              </div>
            </div>

            <div className="give-side">
              <div className="side-card">
                <div className="side-icon">
                  <HeartHandshake size={23} />
                </div>
                <h3>Clarity before checkout</h3>
                <p>
                  Explore what an initiative says it needs before
                  deciding whether to support it.
                </p>
              </div>

              <div className="side-card">
                <div className="side-icon">
                  <ShieldCheck size={23} />
                </div>
                <h3>Payment status checked</h3>
                <p>
                  The server checks PayPal's capture response before
                  showing a completed Sandbox transaction.
                </p>
              </div>

              <div className="transactions-card">
                <div className="transactions-title">
                  <b>Recent sandbox activity</b>
                  <span>TEST DATA</span>
                </div>

                {payments.length === 0 ? (
                  <p className="empty-transactions">
                    Completed Sandbox checkouts will appear here during
                    this session.
                  </p>
                ) : (
                  payments.map((payment) => (
                    <div className="transaction-row" key={payment.id}>
                      <span className="transaction-check">
                        <CheckCircle2 size={17} />
                      </span>
                      <span className="transaction-info">
                        <b>{payment.initiative}</b>
                        <small>
                          {payment.status} · {payment.id.slice(-7)}
                        </small>
                      </span>
                      <strong>{money(payment.amount)}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="section-wrap how-section"
        >
          <div className="section-heading centered-heading">
            <div className="eyebrow">SIMPLE BY DESIGN</div>
            <h2>
              A clearer path from <span>care to action.</span>
            </h2>
          </div>

          <div className="steps-grid">
            <div className="step">
              <span className="step-num">01</span>
              <div className="step-icon">
                <Sparkles />
              </div>
              <h3>Discover with AI</h3>
              <p>
                Explore initiative details and ask questions to compare
                possible ways to help.
              </p>
            </div>

            <div className="step">
              <span className="step-num">02</span>
              <div className="step-icon">
                <HeartHandshake />
              </div>
              <h3>Choose with care</h3>
              <p>
                Select an initiative and a contribution amount that
                suits your intention.
              </p>
            </div>

            <div className="step">
              <span className="step-num">03</span>
              <div className="step-icon">
                <Wallet />
              </div>
              <h3>Test with PayPal</h3>
              <p>
                Use the Sandbox checkout to test order approval and
                payment capture safely.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="section-wrap footer-inner">
          <a href="#home" className="brand footer-brand">
            <span className="brand-mark">
              <HandHeart size={21} />
            </span>
            <span>
              impactbridge<span className="brand-ai">AI</span>
            </span>
          </a>
          <p>Built to explore a more thoughtful giving experience.</p>
          <span className="footer-note">
            Hackathon prototype · PayPal Sandbox
          </span>
        </div>
      </footer>
    </div>
  );
}
