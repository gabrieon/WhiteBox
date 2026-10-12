// Higher or Lower — comparison pool.
//
// Each card is a real, checkable fact. Mixing magnitudes (millions, metres,
// dollars) is deliberate: players must remember the *order* of wildly
// different quantities rather than a single narrow scale.

export const COMPARISON_CARDS = [
  { label: 'Population of Egypt', value: 112, unit: 'million' },
  { label: 'Population of Nigeria', value: 223, unit: 'million' },
  { label: 'Population of Vietnam', value: 98, unit: 'million' },
  { label: 'Population of Turkey', value: 85, unit: 'million' },
  { label: 'Population of Kenya', value: 55, unit: 'million' },
  { label: 'Population of Peru', value: 34, unit: 'million' },
  { label: 'Population of Morocco', value: 37, unit: 'million' },
  { label: 'Population of Canada', value: 40, unit: 'million' },

  { label: 'Mount Everest', value: 8849, unit: 'm' },
  { label: 'K2', value: 8611, unit: 'm' },
  { label: 'Mount Kilimanjaro', value: 5895, unit: 'm' },
  { label: 'Mount Denali', value: 6190, unit: 'm' },
  { label: 'Mont Blanc', value: 4808, unit: 'm' },
  { label: 'Mount Kenya', value: 5199, unit: 'm' },
  { label: 'Matterhorn', value: 4478, unit: 'm' },
  { label: 'Mount Fuji', value: 3776, unit: 'm' },

  { label: 'Eiffel Tower', value: 330, unit: 'm' },
  { label: 'Burj Khalifa', value: 828, unit: 'm' },
  { label: 'Empire State Building', value: 381, unit: 'm' },
  { label: 'Statue of Liberty', value: 93, unit: 'm' },
  { label: 'Big Ben', value: 96, unit: 'm' },
  { label: 'Tokyo Skytree', value: 634, unit: 'm' },
  { label: 'Ozymandias (Great Pyramid)', value: 146, unit: 'm' },

  { label: 'A US gallon', value: 3.8, unit: 'litres' },
  { label: 'A tennis ball court', value: 260, unit: 'm²' },
  { label: 'A football pitch', value: 7140, unit: 'm²' },
  { label: 'The Moon surface area', value: 37.9, unit: 'million km²' },
  { label: 'The Pacific Ocean area', value: 165, unit: 'million km²' },

  { label: 'Red blood cells per drop', value: 20000, unit: '' },
  { label: 'Lung surface area', value: 70, unit: 'm²' },
  { label: 'Venus day length', value: 116.75, unit: 'Earth days' },
  { label: 'Mercury day length', value: 176, unit: 'Earth days' },
  { label: 'Sun surface temperature', value: 5500, unit: '°C' },
  { label: 'Deepest ocean trench', value: 10994, unit: 'm' },
  { label: 'Amazon rainforest area', value: 5.5, unit: 'million km²' },
  { label: 'Great Wall of China', value: 21196, unit: 'km' },
  { label: 'Nile length', value: 6650, unit: 'km' },
  { label: 'Amazon river length', value: 6400, unit: 'km' },
];

export const TARGET_SCORE = 7;