export function sessionStatusLabel(status: string) {
  switch (status) {
    case 'pendente':
      return 'Pendente de aplicação';
    case 'aguardando_enfermagem':
      return 'Aguardando enfermagem';
    case 'concluido':
      return 'Concluída';
    default:
      return status;
  }
}

export function sessionSectionLabel(section: string) {
  switch (section) {
    case 'resumo':
      return 'Resumo';
    case 'medicamentos':
      return 'Medicamentos';
    case 'aplicacao':
      return 'Aplicação';
    case 'assinatura':
      return 'Assinatura';
    case 'enfermagem':
      return 'Enfermagem';
    default:
      return section;
  }
}
