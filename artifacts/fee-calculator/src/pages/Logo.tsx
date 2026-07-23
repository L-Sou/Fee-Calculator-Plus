import React from 'react';

export default function Logo() {
  return (
    <a 
      href="https://www.seamariner.com" 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-block mb-4 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
      aria-label="Visit Seamariner Homepage"
    >
      <img 
        src="/Seamariner_Primary_Logo_Full_Color_Rgb_900px_w_72ppi - No Background.png" 
        alt="Seamariner Logo" 
        className="h-14 md:h-15 w-auto object-contain" 
      />
    </a>
  );
}