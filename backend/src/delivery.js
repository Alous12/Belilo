export const DEPARTMENTS = [
  'La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí',
  'Chuquisaca', 'Tarija', 'Beni', 'Pando',
];

export function withDepartments(settings) {
  return { ...settings, departments: DEPARTMENTS };
}
