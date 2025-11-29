
import React, { useEffect, useState } from 'react';
import { Headset, Instagram, MessageCircle, Sparkles } from 'lucide-react';
import { db } from '../services/db';
import { SocialLinks } from '../types';

const Footer: React.FC = () => {
  const [links, setLinks] = useState<SocialLinks>({});
  const year = new Date().getFullYear();

  useEffect(() => {
    db.getSettings().then(s => {
      if (s?.socialLinks) {
        setLinks(s.socialLinks);
      }
    }).catch(console.error);
  }, []);

  return (
    <footer className="w-full py-4 mt-auto border-t border-cyan-500/10 bg-transparent backdrop-blur-sm">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Credits - Neon Style */}
        <div className="text-xs text-slate-500 font-light flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          <Sparkles className="w-3 h-3 text-cyan-500/50" />
          <span>© {year} نظام حاضر</span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span>تطوير: <span className="text-cyan-400/80 font-medium hover:text-cyan-400 transition-colors">أ. هيثم الزهراني</span></span>
        </div>

        {/* Social Icons (Dynamic) - Neon Glow on Hover */}
        <div className="flex items-center gap-4">
          {links?.supportUrl && (
            <a 
              href={links.supportUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-slate-500 hover:text-cyan-400 transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" 
              title="الدعم الفني"
            >
              <Headset className="w-5 h-5" />
            </a>
          )}
          {links?.whatsapp && (
            <a 
              href={links.whatsapp.startsWith('http') ? links.whatsapp : `https://wa.me/${links.whatsapp.replace(/\D/g, '')}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-slate-500 hover:text-emerald-400 transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
              title="واتساب"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
          )}
          {links?.instagram && (
            <a 
              href={links.instagram.startsWith('http') ? links.instagram : `https://instagram.com/${links.instagram.replace('@', '')}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-slate-500 hover:text-pink-400 transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]" 
              title="انستجرام"
            >
              <Instagram className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
