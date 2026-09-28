import { AudioLines, AudioWaveform, Bot, Code2, Figma, Github, HeartPulse, MessageSquare, Sparkles, Video, type LucideIcon } from 'lucide-react';

export type Tool = { id: string; name: string; logoUrl: string };
export type Stat = { id: string; value: string; label: string };

// Static fallback — used when Supabase isn't configured, and if the live "tools"/"stats"
// tables can't be reached, so the section is never empty.
export const tools: Tool[] = [
  { id: 'claude', name: 'Claude', logoUrl: '' },
  { id: 'github-copilot', name: 'GitHub Copilot', logoUrl: '' },
  { id: 'chatgpt', name: 'ChatGPT', logoUrl: '' },
  { id: 'vs-code', name: 'VS Code', logoUrl: '' },
  { id: 'github', name: 'GitHub', logoUrl: '' },
  { id: 'figma', name: 'Figma', logoUrl: '' },
  { id: 'elevenlabs', name: 'ElevenLabs', logoUrl: '' },
  { id: 'deepgram', name: 'Deepgram', logoUrl: '' },
  { id: 'cartesia-ai', name: 'Cartesia AI', logoUrl: '' },
  { id: 'livekit', name: 'LiveKit', logoUrl: '' },
];

export const stats: Stat[] = [
  { id: 'hours', value: '500+', label: 'Development Hours' },
  { id: 'projects', value: '5+', label: 'Projects Built' },
  { id: 'languages', value: '3+', label: 'Languages Known' },
];

// Line-icon fallback for a tool that doesn't have an uploaded logo yet, matched by name.
const toolIcons: Record<string, LucideIcon> = {
  claude: Sparkles,
  'github-copilot': Bot,
  chatgpt: MessageSquare,
  'vs-code': Code2,
  github: Github,
  figma: Figma,
  elevenlabs: AudioWaveform,
  deepgram: AudioLines,
  'cartesia-ai': HeartPulse,
  livekit: Video,
};

export const slugifyToolName = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const toolIconFor = (name: string): LucideIcon | undefined => toolIcons[slugifyToolName(name)];
