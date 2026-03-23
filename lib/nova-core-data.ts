// Nova Core Data Model
// Tüm organizasyon yapısı, AI agentlar ve kişiselleştirme mantığı

export type UserRole = 'sales' | 'support' | 'marketing' | 'pmo' | 'admin' | 'super_admin';

export type TeamMember = {
  name: string;
  title: string;
  role: UserRole;
  team: string;
  email?: string;
};

export type AIProgram = {
  id: string;
  name: string;
  category: 'core_llm' | 'agent_automation' | 'enterprise' | 'creative' | 'development';
  description: string;
  tools: string[];
};

export type AIAgent = {
  id: string;
  name: string;
  category: string;
  description: string;
  roles: UserRole[]; // Hangi roller kullanabilir
  status: 'active' | 'planned' | 'testing';
  priority: 'high' | 'medium' | 'low';
};

export type HubNode = {
  id: string;
  label: string;
  color: 'emerald' | 'violet' | 'sky' | 'pink' | 'orange' | 'cyan';
  role: UserRole | 'all';
  description: string;
  team: string[];
  responsibilities: string[];
  connectedSystems: string[];
};

// ============================================
// EKIP YAPISI
// ============================================

export const TEAM_STRUCTURE: TeamMember[] = [
  // Satış
  { name: 'Ömer Canatar', title: 'Key Account Manager', role: 'sales', team: 'Satış', email: 'omer@pax.com.tr' },
  { name: 'Furkan Kızılkurt', title: 'Technical Account Manager', role: 'sales', team: 'Satış', email: 'furkan@pax.com.tr' },
  { name: 'Can Önder', title: 'Satış Stajyeri', role: 'sales', team: 'Satış' },
  
  // Support
  { name: 'İshak Çelik', title: 'Support + POM', role: 'support', team: 'Retail Support / POM' },
  { name: 'Taha Bitim', title: 'Support + AI Köprüsü', role: 'support', team: 'Retail Support / POM' },
  
  // Marketing & PMO
  { name: 'Mete Özdemir', title: 'Marketing', role: 'marketing', team: 'Pazarlama / AI / PMO' },
  { name: 'Dilara', title: 'AI Destekli İçerik', role: 'marketing', team: 'Pazarlama / AI / PMO' },
  { name: 'Eda Kılıç', title: 'PMO & AI Automation', role: 'pmo', team: 'Pazarlama / AI / PMO' },
];

// ============================================
// AI PROGRAMLAR
// ============================================

export const AI_PROGRAMS: AIProgram[] = [
  {
    id: 'core-llm',
    name: 'Core LLM',
    category: 'core_llm',
    description: 'Beyin Katmanı',
    tools: ['ChatGPT', 'Claude', 'Google Gemini']
  },
  {
    id: 'agent-automation',
    name: 'Agent & Automation',
    category: 'agent_automation',
    description: 'Karar ve Aksiyon',
    tools: ['n8n', 'LumeFlow']
  },
  {
    id: 'enterprise-ai',
    name: 'Kurumsal AI',
    category: 'enterprise',
    description: 'Günlük İş Hızı',
    tools: ['Microsoft 365 Copilot', 'SharePoint AI Search']
  },
  {
    id: 'creative-ai',
    name: 'Kreatif AI',
    category: 'creative',
    description: 'İçerik & Görsel',
    tools: ['Canva AI', 'Kling AI', 'Google Imagen']
  },
  {
    id: 'development-ai',
    name: 'Development AI',
    category: 'development',
    description: 'Kod & Ürün',
    tools: ['GitHub Copilot', 'Verdent AI', 'Windsurf']
  }
];

// ============================================
// AI AGENTLAR (52 toplam - rollere göre filtreleniyor)
// ============================================

export const AI_AGENTS: AIAgent[] = [
  // SATIŞ AGENTLARI
  {
    id: 'follow-up-agent',
    name: 'Follow-up Agent',
    category: 'Satış Desteği',
    description: 'Müşteri takibi için otomatik hatırlatıcı ve mail gönderimi',
    roles: ['sales', 'admin'],
    status: 'active',
    priority: 'high'
  },
  {
    id: 'proposal-builder',
    name: 'Teklif Hazırlayıcı',
    category: 'Satış Desteği',
    description: 'Otomatik teklif oluşturma ve fiyatlandırma',
    roles: ['sales', 'admin'],
    status: 'active',
    priority: 'high'
  },
  {
    id: 'customer-segmentation',
    name: 'Müşteri Segmentasyon Agent',
    category: 'Satış Desteği',
    description: 'CRM datası üzerinden müşteri segmentasyonu',
    roles: ['sales', 'admin'],
    status: 'active',
    priority: 'medium'
  },
  {
    id: 'pipeline-forecast',
    name: 'Pipeline Forecast Agent',
    category: 'Satış Desteği',
    description: 'Satış pipeline tahmini ve forecast',
    roles: ['sales', 'admin'],
    status: 'testing',
    priority: 'high'
  },
  {
    id: 'meeting-prep',
    name: 'Toplantı Hazırlık Agent',
    category: 'Satış Desteği',
    description: 'Müşteri toplantısı öncesi brief hazırlama',
    roles: ['sales', 'admin'],
    status: 'active',
    priority: 'medium'
  },
  {
    id: 'competitor-analysis',
    name: 'Rakip Analiz Agent',
    category: 'Satış Desteği',
    description: 'Otomatik rakip analizi ve positioning',
    roles: ['sales', 'marketing', 'admin'],
    status: 'planned',
    priority: 'low'
  },
  {
    id: 'lead-scoring',
    name: 'Lead Scoring Agent',
    category: 'Satış Desteği',
    description: 'Potansiyel müşteri puanlama ve önceliklendirme',
    roles: ['sales', 'admin'],
    status: 'testing',
    priority: 'medium'
  },
  {
    id: 'sales-analytics',
    name: 'Satış Analitiği Agent',
    category: 'Satış Desteği',
    description: 'Satış performans analizi ve raporlama',
    roles: ['sales', 'admin'],
    status: 'active',
    priority: 'medium'
  },

  // SUPPORT AGENTLARI
  {
    id: 'ticket-router',
    name: 'Ticket Router Agent',
    category: 'Support',
    description: 'Destek taleplerini otomatik kategorize ve yönlendir',
    roles: ['support', 'admin'],
    status: 'active',
    priority: 'high'
  },
  {
    id: 'solution-suggester',
    name: 'Çözüm Öneri Agent',
    category: 'Support',
    description: 'Geçmiş ticketlara göre çözüm önerisi',
    roles: ['support', 'admin'],
    status: 'active',
    priority: 'high'
  },
  {
    id: 'knowledge-base',
    name: 'Knowledge Base Agent',
    category: 'Support',
    description: 'Dokümantasyon ve bilgi bankası yönetimi',
    roles: ['support', 'admin'],
    status: 'active',
    priority: 'medium'
  },
  {
    id: 'sla-monitor',
    name: 'SLA Monitoring Agent',
    category: 'Support',
    description: 'SLA takibi ve gecikme uyarıları',
    roles: ['support', 'admin'],
    status: 'active',
    priority: 'high'
  },
  {
    id: 'customer-health',
    name: 'Müşteri Sağlığı Agent',
    category: 'Support',
    description: 'Müşteri memnuniyeti ve risk tespiti',
    roles: ['support', 'sales', 'admin'],
    status: 'testing',
    priority: 'medium'
  },
  {
    id: 'escalation-manager',
    name: 'Escalation Manager',
    category: 'Support',
    description: 'Kritik ticket yükseltme ve yönetim',
    roles: ['support', 'admin'],
    status: 'active',
    priority: 'high'
  },

  // MARKETING AGENTLARI
  {
    id: 'content-generator',
    name: 'İçerik Üretici Agent',
    category: 'Marketing',
    description: 'Blog, sosyal medya ve email içerik üretimi',
    roles: ['marketing', 'admin'],
    status: 'active',
    priority: 'high'
  },
  {
    id: 'campaign-optimizer',
    name: 'Kampanya Optimizasyon Agent',
    category: 'Marketing',
    description: 'Kampanya performansı ve optimizasyon önerileri',
    roles: ['marketing', 'admin'],
    status: 'testing',
    priority: 'medium'
  },
  {
    id: 'social-scheduler',
    name: 'Sosyal Medya Planlayıcı',
    category: 'Marketing',
    description: 'Otomatik sosyal medya paylaşım planlama',
    roles: ['marketing', 'admin'],
    status: 'active',
    priority: 'medium'
  },
  {
    id: 'visual-designer',
    name: 'Görsel Tasarım Agent',
    category: 'Marketing',
    description: 'AI destekli görsel ve grafik tasarımı',
    roles: ['marketing', 'admin'],
    status: 'active',
    priority: 'medium'
  },
  {
    id: 'seo-optimizer',
    name: 'SEO Optimizasyon Agent',
    category: 'Marketing',
    description: 'İçerik SEO analizi ve optimizasyon',
    roles: ['marketing', 'admin'],
    status: 'planned',
    priority: 'low'
  },
  {
    id: 'email-personalization',
    name: 'Email Kişiselleştirme Agent',
    category: 'Marketing',
    description: 'Kişiselleştirilmiş email kampanyaları',
    roles: ['marketing', 'sales', 'admin'],
    status: 'testing',
    priority: 'medium'
  },

  // PMO AGENTLARI
  {
    id: 'project-tracker',
    name: 'Proje Takip Agent',
    category: 'PMO',
    description: 'Proje ilerleme takibi ve raporlama',
    roles: ['pmo', 'admin'],
    status: 'active',
    priority: 'high'
  },
  {
    id: 'resource-planner',
    name: 'Kaynak Planlama Agent',
    category: 'PMO',
    description: 'Ekip ve kaynak tahsisi optimizasyonu',
    roles: ['pmo', 'admin'],
    status: 'testing',
    priority: 'medium'
  },
  {
    id: 'meeting-summarizer',
    name: 'Toplantı Özeti Agent',
    category: 'PMO',
    description: 'Toplantı notları ve aksiyon maddesi çıkarma',
    roles: ['pmo', 'admin'],
    status: 'active',
    priority: 'high'
  },
  {
    id: 'timeline-optimizer',
    name: 'Timeline Optimizasyon Agent',
    category: 'PMO',
    description: 'Proje zaman çizelgesi optimizasyonu',
    roles: ['pmo', 'admin'],
    status: 'planned',
    priority: 'low'
  },
  {
    id: 'risk-analyzer',
    name: 'Risk Analiz Agent',
    category: 'PMO',
    description: 'Proje risk tespiti ve önleme',
    roles: ['pmo', 'admin'],
    status: 'testing',
    priority: 'medium'
  },
  {
    id: 'status-reporter',
    name: 'Durum Raporu Agent',
    category: 'PMO',
    description: 'Otomatik haftalık/aylık durum raporu',
    roles: ['pmo', 'admin'],
    status: 'active',
    priority: 'high'
  },

  // ÇAPRAZ AGENTLAR (Herkes kullanabilir)
  {
    id: 'document-analyzer',
    name: 'Doküman Analiz Agent',
    category: 'Genel',
    description: 'PDF, Word doküman analizi ve özet çıkarma',
    roles: ['sales', 'support', 'marketing', 'pmo', 'admin'],
    status: 'active',
    priority: 'medium'
  },
  {
    id: 'translator',
    name: 'Çeviri Agent',
    category: 'Genel',
    description: 'Çoklu dil çeviri ve lokalizasyon',
    roles: ['sales', 'support', 'marketing', 'pmo', 'admin'],
    status: 'active',
    priority: 'low'
  },
  {
    id: 'data-extractor',
    name: 'Veri Çıkarma Agent',
    category: 'Genel',
    description: 'Yapılandırılmamış veriden bilgi çıkarma',
    roles: ['sales', 'support', 'marketing', 'pmo', 'admin'],
    status: 'active',
    priority: 'medium'
  },
];

// ============================================
// HUB NODES
// ============================================

export const HUB_NODES: HubNode[] = [
  {
    id: 'sales',
    label: 'Satış',
    color: 'emerald',
    role: 'sales',
    description: 'Gelir üreten ana temas alanı',
    team: ['Ömer Canatar', 'Furkan Kızılkurt', 'Can Önder'],
    responsibilities: ['Direk müşteriler', 'Partner ilişkileri', 'Teklif süreci', 'CRM yönetimi'],
    connectedSystems: ['CRM', 'Teklif Sistemi', 'Follow-up Agent', 'Forecast Agent']
  },
  {
    id: 'partners',
    label: 'İş Ortaklıkları',
    color: 'violet',
    role: 'sales',
    description: 'Entegrasyon ve yayılım katmanı',
    team: ['Satış + Teknik'],
    responsibilities: ['Partner yönetimi', 'Entegrasyon uyumu', 'Yayılım koordinasyonu'],
    connectedSystems: ['Nebim', 'Toshiba', 'Tera', 'Logo']
  },
  {
    id: 'support',
    label: 'Retail Support',
    color: 'sky',
    role: 'support',
    description: 'Müşteri destek ve POM',
    team: ['İshak Çelik', 'Taha Bitim'],
    responsibilities: ['JIRA ticket yönetimi', 'ITSM süreçleri', 'Rollout koordinasyonu', 'SLA takibi'],
    connectedSystems: ['JIRA', 'ITSM', 'Ticket Router Agent', 'SLA Monitor']
  },
  {
    id: 'marketing',
    label: 'Marketing',
    color: 'pink',
    role: 'marketing',
    description: 'İçerik ve kampanya yönetimi',
    team: ['Mete Özdemir', 'Dilara'],
    responsibilities: ['İçerik üretimi', 'Kampanya yönetimi', 'Sosyal medya', 'SEO'],
    connectedSystems: ['Canva AI', 'Content Generator', 'Campaign Optimizer']
  },
  {
    id: 'ai-factory',
    label: 'AI Fabrikası',
    color: 'orange',
    role: 'pmo',
    description: 'AI agent geliştirme ve otomasyon',
    team: ['Eda Kılıç', 'Taha Bitim'],
    responsibilities: ['Agent geliştirme', 'Otomasyon kurulumu', 'n8n workflow', 'AI entegrasyonları'],
    connectedSystems: ['n8n', 'LumeFlow', 'Claude API', 'OpenAI API']
  },
  {
    id: 'pmo',
    label: 'PMO / POM',
    color: 'cyan',
    role: 'pmo',
    description: 'Proje ve operasyon yönetimi',
    team: ['Eda Kılıç', 'İshak Çelik'],
    responsibilities: ['Proje takibi', 'Kaynak planlaması', 'Timeline yönetimi', 'Durum raporlama'],
    connectedSystems: ['Project Tracker', 'Timeline Optimizer', 'Status Reporter']
  }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    sales: 'Satış',
    support: 'Support',
    marketing: 'Marketing',
    pmo: 'PMO',
    admin: 'Admin',
    super_admin: 'Super Admin'
  };
  return labels[role] || role;
}

export function getUserTeam(role: UserRole): TeamMember[] {
  return TEAM_STRUCTURE.filter(m => m.role === role);
}

export function getUserAgents(role: UserRole): AIAgent[] {
  return AI_AGENTS.filter(a => a.roles.includes(role));
}

export function getRoleNode(role: UserRole): string {
  const nodeMap: Record<UserRole, string> = {
    sales: 'sales',
    support: 'support',
    marketing: 'marketing',
    pmo: 'pmo',
    admin: 'sales', // Default
    super_admin: 'sales' // Default
  };
  return nodeMap[role] || 'sales';
}

export function getAgentsByCategory(role: UserRole): Record<string, AIAgent[]> {
  const agents = getUserAgents(role);
  const grouped: Record<string, AIAgent[]> = {};
  
  agents.forEach(agent => {
    if (!grouped[agent.category]) {
      grouped[agent.category] = [];
    }
    grouped[agent.category].push(agent);
  });
  
  return grouped;
}

export function getAgentCount(role: UserRole): { total: number; active: number; planned: number } {
  const agents = getUserAgents(role);
  return {
    total: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    planned: agents.filter(a => a.status === 'planned').length
  };
}
