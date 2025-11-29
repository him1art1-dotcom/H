
import React, { useEffect, useState } from 'react';
import { Headset, Instagram, MessageCircle } from 'lucide-react';
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
    <footer className="w-full py-4 mt-auto border-t border-white/5 bg-transparent backdrop-blur-sm">
      <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Credits */}
        <div className="text-xs text-gray-500 font-light flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          <span>© {year} نظام حاضر</span>
          <span className="hidden sm:inline text-gray-700">|</span>
          <span>تطوير: <span className="text-primary-400/80 font-medium hover:text-primary-400 transition-colors">أ. هيثم الزهراني</span></span>
        </div>

        {/* Social Icons (Dynamic) */}
        <div className="flex items-center gap-4">
          {links?.supportUrl && (
            <a 
              href={links.supportUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-500 hover:text-blue-400 transition-all duration-300 hover:scale-110" 
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
              className="text-gray-500 hover:text-emerald-400 transition-all duration-300 hover:scale-110" 
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
              className="text-gray-500 hover:text-pink-400 transition-all duration-300 hover:scale-110" 
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

