import {
  FiArchive,
  FiCoffee,
  FiDollarSign,
  FiHome,
  FiPackage,
  FiShoppingCart,
  FiUsers,
} from 'react-icons/fi';

export const TRIP_MODULES = [
  {
    id: 'summary',
    label: 'Resumen',
    path: '',
    icon: FiHome,
  },
  {
    id: 'expenses',
    label: 'Gastos',
    path: 'gastos',
    icon: FiDollarSign,
  },
  {
    id: 'meals',
    label: 'Comidas',
    path: 'comidas',
    icon: FiCoffee,
  },
  {
    id: 'shopping',
    label: 'Compras',
    path: 'compras',
    icon: FiShoppingCart,
  },
  {
    id: 'empanadas',
    label: 'Empanadas',
    path: 'empanadas',
    icon: FiPackage,
  },
  {
    id: 'leftovers',
    label: 'Sobras',
    path: 'sobras',
    icon: FiArchive,
  },
  {
    id: 'members',
    label: 'Participantes',
    path: 'participantes',
    icon: FiUsers,
  },
];

export function getTripModule(moduleId) {
  return TRIP_MODULES.find((module) => module.id === moduleId) || null;
}
