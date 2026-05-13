'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const SignInModal = dynamic(() => import('./SignInModal'), { ssr: false });

const NAV_LINKS = [
  { label: 'Home',        href: '#top',          scroll: true  },
  { label: 'Product',     href: '#product',      scroll: true  },
  { label: 'Features',    href: '#features',     scroll: true  },
  { label: 'How It Works',href: '#how-it-works', scroll: true  },
  { label: 'FAQ',         href: '#faq',          scroll: true  },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    setMenuOpen(false);
    if (href === '#top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const id = href.replace('#', '');
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6 md:px-10 transition-all duration-300"
        style={{
          background: scrolled || menuOpen ? 'rgba(13,19,34,0.95)' : 'transparent',
          backdropFilter: scrolled || menuOpen ? 'blur(20px)' : 'none',
          borderBottom: scrolled || menuOpen ? '1px solid rgba(66,71,84,0.3)' : '1px solid transparent',
        }}
      >
        {/* Logo — left */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 z-10">
          <div className="w-8 h-8">
            <img src="/sovalogo.svg" alt="SOVA" className="w-full h-full object-contain" />
          </div>
          <span className="text-base font-black tracking-tighter gradient-text-primary -ml-2">SOVA</span>
        </Link>

        {/* Nav links — absolutely centred in the full nav bar (desktop only) */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-highest/30 whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3 z-10">
          {/* Desktop buttons */}
          <button
            onClick={() => setShowSignIn(true)}
            className="hidden sm:flex items-center px-4 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest text-on-surface transition-all hover:bg-surface-container-highest/40"
            style={{ border: '1px solid rgba(113,127,160,0.55)' }}
          >
            Sign In
          </button>
          <Link
            href="/signup"
            className="hidden sm:flex items-center gap-1.5 px-4 h-8 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
              color: '#001a42',
              boxShadow: '0 0 20px rgba(77,142,255,0.3)',
            }}
          >
            Sign Up
          </Link>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-outline hover:text-on-surface transition-colors"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-xl">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </motion.nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-16 left-0 right-0 z-40 md:hidden"
            style={{
              background: 'rgba(13,19,34,0.97)',
              backdropFilter: 'blur(24px)',
              borderBottom: '1px solid rgba(66,71,84,0.35)',
            }}
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-outline hover:text-on-surface hover:bg-surface-container-highest/20 transition-colors rounded-xl"
                >
                  {link.label}
                </a>
              ))}
              <div className="h-px my-2" style={{ background: 'rgba(66,71,84,0.3)' }} />
              <button
                onClick={() => { setShowSignIn(true); setMenuOpen(false); }}
                className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-on-surface text-left rounded-xl hover:bg-surface-container-highest/20 transition-colors"
                style={{ border: '1px solid rgba(113,127,160,0.3)' }}
              >
                Sign In
              </button>
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-center rounded-xl mt-1"
                style={{
                  background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)',
                  color: '#001a42',
                }}
              >
                Sign Up
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign-in modal */}
      <AnimatePresence>
        {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
      </AnimatePresence>
    </>
  );
}
