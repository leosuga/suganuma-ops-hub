export interface TaskTemplate {
  title: string
  category?: "finance" | "logistics" | "personal" | "health"
  priority?: "low" | "med" | "high" | "urgent"
}

export interface ProjectTemplate {
  id: string
  name: string
  color: string
  description: string
  tasks: TaskTemplate[]
}

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: "house-reno",
    name: "Reforma / Casa Nova",
    color: "#FB923C",
    description: "Acompanhar obra, reforma ou mudança",
    tasks: [
      { title: "Orçar materiais e mão de obra", category: "finance", priority: "high" },
      { title: "Contratar empreiteiro / pedreiro", category: "logistics", priority: "urgent" },
      { title: "Comprar material hidráulico", category: "logistics" },
      { title: "Comprar material elétrico", category: "logistics" },
      { title: "Revestimentos: cerâmica / porcelanato", category: "logistics" },
      { title: "Pintura: escolher cores e contratar", category: "logistics", priority: "low" },
      { title: "Móveis planejados: orçar e fechar", category: "finance", priority: "med" },
      { title: "Vistoria final e checklist", category: "logistics", priority: "high" },
    ],
  },
  {
    id: "server-setup",
    name: "Setup Servidor / Infra",
    color: "#60A5FA",
    description: "Provisionar VPS, domínio, DNS, CI/CD",
    tasks: [
      { title: "Comprar domínio e configurar DNS", category: "logistics", priority: "urgent" },
      { title: "Provisionar VPS (Hetzner / Oracle / DO)", category: "logistics", priority: "urgent" },
      { title: "Configurar firewall e SSH", category: "logistics", priority: "urgent" },
      { title: "Instalar Docker e Docker Compose", category: "logistics", priority: "high" },
      { title: "Configurar Caddy / Traefik (proxy reverso)", category: "logistics", priority: "high" },
      { title: "Setup CI/CD (GitHub Actions)", category: "logistics", priority: "med" },
      { title: "Configurar backups automáticos", category: "logistics", priority: "med" },
      { title: "Monitoramento (healthchecks, logs)", category: "logistics", priority: "low" },
      { title: "Documentar arquitetura", category: "personal", priority: "low" },
    ],
  },
  {
    id: "study-plan",
    name: "Plano de Estudos",
    color: "#C084FC",
    description: "Certificação, concurso ou aprendizado",
    tasks: [
      { title: "Definir cronograma de estudos (horas/semana)", category: "personal", priority: "urgent" },
      { title: "Comprar / baixar material de estudo", category: "finance", priority: "high" },
      { title: "Separar tópicos por semana", category: "personal", priority: "high" },
      { title: "Fazer simulados / exercícios práticos", category: "personal", priority: "med" },
      { title: "Revisão de erros e pontos fracos", category: "personal", priority: "med" },
      { title: "Agendar data da prova / exame", category: "logistics", priority: "high" },
      { title: "Revisão final pré-prova", category: "personal", priority: "urgent" },
    ],
  },
  {
    id: "freelance",
    name: "Projeto Freelance",
    color: "#4ADE80",
    description: "Desenvolvimento de site, app ou sistema",
    tasks: [
      { title: "Briefing / levantamento de requisitos", category: "logistics", priority: "urgent" },
      { title: "Proposta comercial e contrato", category: "finance", priority: "urgent" },
      { title: "Wireframes / protótipo (Figma)", category: "logistics", priority: "high" },
      { title: "Setup repositório e dev environment", category: "logistics", priority: "high" },
      { title: "Desenvolvimento frontend", category: "logistics", priority: "high" },
      { title: "Desenvolvimento backend / API", category: "logistics", priority: "high" },
      { title: "Integração e testes", category: "logistics", priority: "med" },
      { title: "Deploy e homologação", category: "logistics", priority: "med" },
      { title: "Entrega final e documentação", category: "logistics", priority: "high" },
      { title: "Faturamento final", category: "finance", priority: "high" },
    ],
  },
  {
    id: "event-planning",
    name: "Evento / Viagem",
    color: "#55D7ED",
    description: "Organizar casamento, aniversário ou viagem",
    tasks: [
      { title: "Definir data, local e orçamento", category: "logistics", priority: "urgent" },
      { title: "Lista de convidados / participantes", category: "personal", priority: "high" },
      { title: "Reservar local / comprar passagens", category: "finance", priority: "urgent" },
      { title: "Contratar fornecedores (buffet, foto, som)", category: "finance", priority: "high" },
      { title: "Enviar convites / confirmar presenças", category: "personal", priority: "med" },
      { title: "Checklist final (48h antes)", category: "logistics", priority: "urgent" },
      { title: "Pós-evento: agradecimentos e fotos", category: "personal", priority: "low" },
    ],
  },
  {
    id: "baby-arrival",
    name: "Chegada do Bebê",
    color: "#F472B6",
    description: "Checklist de preparação: enxoval, documentos, mala da maternidade",
    tasks: [
      { title: "Montar lista de enxoval (roupas, fraldas, higiene)", category: "logistics", priority: "med" },
      { title: "Comprar berço, carrinho e bebê conforto", category: "finance", priority: "high" },
      { title: "Preparar o quarto do bebê", category: "logistics", priority: "med" },
      { title: "Pesquisar e agendar pediatra", category: "health", priority: "high" },
      { title: "Escolher maternidade e conhecer a estrutura", category: "logistics", priority: "high" },
      { title: "Montar mala da maternidade (mãe e bebê)", category: "logistics", priority: "urgent" },
      { title: "Providenciar documentos: certidão, plano de saúde", category: "logistics", priority: "med" },
      { title: "Organizar licença-maternidade/paternidade no trabalho", category: "logistics", priority: "high" },
      { title: "Instalar bebê conforto no carro", category: "logistics", priority: "med" },
      { title: "Definir rede de apoio para o pós-parto", category: "personal", priority: "low" },
    ],
  },
]

export function getTemplate(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
