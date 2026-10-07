// Public site settings (edited in the admin panel's Settings page, stored in site_settings.data).
// Kept free of browser-only imports so the build-time prerender script can use it too.

export type PublicSettings = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  location: string;
  roles: string[];
  instagram: string;
  linkedin: string;
  youtube: string;
  github: string;
  heroImage: string;
  aboutPhoto: string;
};

export const defaultPublicSettings: PublicSettings = {
  name: 'Krish Khati',
  tagline: "I'm passionate about creating modern web experiences, exploring the power of AI and digital marketing, and building things that make an impact.",
  email: 'dhimankrish10@gmail.com',
  phone: '+91 93060 91154',
  location: 'Pundri, Kaithal, Haryana, India',
  roles: ['Web Developer', 'Digital Marketer', 'AI Enthusiast'],
  instagram: 'https://www.instagram.com/krish_khati_/',
  linkedin: 'https://www.linkedin.com/in/krish-khati/',
  youtube: 'https://youtube.com',
  github: 'https://github.com/krish-khati',
  heroImage: '',
  aboutPhoto: '',
};
