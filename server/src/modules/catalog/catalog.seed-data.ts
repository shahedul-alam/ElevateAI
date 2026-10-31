export type SeedTerm = { slug: string; name: string; aliases?: string[] }

// Starter vocabulary. Extend freely: the seed is an idempotent upsert keyed on `kind:slug`.
export const SKILLS: SeedTerm[] = [
  { slug: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { slug: 'javascript', name: 'JavaScript', aliases: ['js', 'ecmascript'] },
  { slug: 'react', name: 'React', aliases: ['react.js', 'reactjs'] },
  { slug: 'nodejs', name: 'Node.js', aliases: ['node', 'node js'] },
  { slug: 'python', name: 'Python', aliases: ['py'] },
  { slug: 'java', name: 'Java' },
  { slug: 'csharp', name: 'C#', aliases: ['c sharp'] },
  { slug: 'cpp', name: 'C++', aliases: ['cplusplus'] },
  { slug: 'go', name: 'Go', aliases: ['golang'] },
  { slug: 'rust', name: 'Rust' },
  { slug: 'sql', name: 'SQL' },
  { slug: 'postgresql', name: 'PostgreSQL', aliases: ['postgres', 'psql'] },
  { slug: 'mongodb', name: 'MongoDB', aliases: ['mongo'] },
  { slug: 'redis', name: 'Redis' },
  { slug: 'docker', name: 'Docker' },
  { slug: 'kubernetes', name: 'Kubernetes', aliases: ['k8s'] },
  { slug: 'aws', name: 'AWS', aliases: ['amazon web services'] },
  { slug: 'gcp', name: 'Google Cloud', aliases: ['google cloud platform', 'gcp'] },
  { slug: 'azure', name: 'Microsoft Azure' },
  { slug: 'git', name: 'Git' },
  { slug: 'graphql', name: 'GraphQL' },
  { slug: 'rest-api', name: 'REST APIs', aliases: ['rest', 'restful'] },
  { slug: 'html-css', name: 'HTML/CSS', aliases: ['html', 'css', 'html5', 'css3'] },
  { slug: 'tailwind', name: 'Tailwind CSS', aliases: ['tailwindcss'] },
  { slug: 'machine-learning', name: 'Machine Learning', aliases: ['ml'] },
  { slug: 'data-analysis', name: 'Data Analysis', aliases: ['data analytics'] },
  { slug: 'project-management', name: 'Project Management' },
  { slug: 'communication', name: 'Communication' },
  { slug: 'figma', name: 'Figma' },
  { slug: 'testing', name: 'Software Testing', aliases: ['qa', 'test automation'] },
]

export const CERTIFICATIONS: SeedTerm[] = [
  { slug: 'aws-solutions-architect', name: 'AWS Certified Solutions Architect' },
  { slug: 'aws-developer', name: 'AWS Certified Developer' },
  { slug: 'gcp-professional-cloud-architect', name: 'Google Professional Cloud Architect' },
  { slug: 'azure-fundamentals', name: 'Microsoft Azure Fundamentals', aliases: ['az-900'] },
  { slug: 'pmp', name: 'Project Management Professional (PMP)', aliases: ['pmp'] },
  { slug: 'cka', name: 'Certified Kubernetes Administrator', aliases: ['cka'] },
  { slug: 'cissp', name: 'CISSP' },
  { slug: 'scrum-master', name: 'Certified Scrum Master', aliases: ['csm'] },
]

export const DOMAINS: SeedTerm[] = [
  { slug: 'fintech', name: 'Fintech', aliases: ['financial technology'] },
  { slug: 'healthcare', name: 'Healthcare', aliases: ['health tech'] },
  { slug: 'ecommerce', name: 'E-commerce', aliases: ['retail tech'] },
  { slug: 'education', name: 'Education', aliases: ['edtech'] },
  { slug: 'saas', name: 'SaaS', aliases: ['software as a service'] },
  { slug: 'logistics', name: 'Logistics', aliases: ['supply chain'] },
  { slug: 'telecom', name: 'Telecommunications', aliases: ['telecom'] },
  { slug: 'media', name: 'Media & Entertainment' },
  { slug: 'government', name: 'Government & Public Sector' },
  { slug: 'manufacturing', name: 'Manufacturing' },
]
