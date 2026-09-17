export const defaultPet = {name: 'Biscuit', coat: 'honey', collar: 'sage', roaming: true};
export const coats = {
  honey: {fur: '#e6b778', ears: '#b98250', cream: '#fff1d5'},
  cream: {fur: '#f3dfb8', ears: '#c9ad86', cream: '#fff8e8'},
  cocoa: {fur: '#99735e', ears: '#654b40', cream: '#f2dbc0'},
  cloud: {fur: '#d1d5da', ears: '#89939f', cream: '#fff9ef'},
};
export const collars = {sage: '#809c76', berry: '#c68193', blue: '#7f9ebb'};
export function validatePet(pet = defaultPet) {
  if (!pet || typeof pet.name !== 'string' || !pet.name.trim() || pet.name.trim().length > 24 ||
      !Object.hasOwn(coats, pet.coat) || !Object.hasOwn(collars, pet.collar) || typeof pet.roaming !== 'boolean' || (pet.species !== undefined && !['dog','cat'].includes(pet.species))) {
    throw new Error('Choose a dog name (1–24 characters), coat, and collar.');
  }
  return {name: pet.name.trim(), coat: pet.coat, collar: pet.collar, roaming: pet.roaming,...(pet.species==='cat'?{species:'cat'}:{})};
}
