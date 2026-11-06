/**
 * Scientific bee curiosities (ES). Cycle without repeats until exhausted.
 */
export const CURIOSITIES = [
  "Una obrera visita hasta 100 flores en un solo viaje de pecoreo.",
  "La danza en ocho indica dirección y distancia a la comida respecto al sol.",
  "Las abejas ven ultravioleta: muchas flores tienen guías que nosotros no vemos.",
  "Para hacer 1 kg de miel pueden volar el equivalente a dar la vuelta al mundo.",
  "El zumbido de vuelo ronda los 200 batidos de ala por segundo.",
  "La reina pone hasta 2000 huevos por día en temporada alta.",
  "Las obreras calientan la cría vibrando los músculos del tórax.",
  "El propóleo es resina de plantas que usan como ‘cemento’ antimicrobiano.",
  "Una colonia puede tener entre 20.000 y 60.000 individuos en verano.",
  "Detectan campos eléctricos débiles en las flores durante el aterrizaje.",
  "La cera sale de glándulas abdominales: construyen hexágonos de ~120°.",
  "Comparten comida boca a boca (trofalaxis): así circula información química.",
  "El olfato de la antena distingue cientos de olores florales.",
  "En invierno forman un racimo y rotan del borde al centro para no enfriar.",
  "Los zánganos no tienen aguijón: su rol es reproducirse con la reina.",
  "La miel madura baja su humedad bajo el 18% y las obreras la operculan.",
  "Usan el sol como brújula y compensan su movimiento a lo largo del día.",
  "Una picadura libera feromonas de alarma que reclutan a otras guardianas.",
  "Las nodrizas producen jalea real en glándulas de la cabeza.",
  "Apis mellifera llegó a América con los europeos; en Lobos hoy polinizan el campo.",
];

export function createCuriosityDeck(savedOrder) {
  let order =
    Array.isArray(savedOrder) && savedOrder.length === CURIOSITIES.length
      ? savedOrder.slice()
      : shuffleIndices(CURIOSITIES.length);
  let cursor = 0;

  function next() {
    if (cursor >= order.length) {
      order = shuffleIndices(CURIOSITIES.length);
      cursor = 0;
    }
    const idx = order[cursor++];
    return { text: CURIOSITIES[idx], index: idx, order, cursor };
  }

  return {
    next,
    getState: () => ({ order, cursor }),
    setCursor: (c) => {
      cursor = c | 0;
    },
  };
}

function shuffleIndices(n) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}
