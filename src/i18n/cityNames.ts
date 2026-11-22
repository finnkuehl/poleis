// City names: picked by the creation order of the city (City.nameIndex), no random numbers.
import { en } from './en';

/** "Argos", ... and after the list wraps "Argos II", "Argos III", ... */
export function cityName(index: number): string {
  const names = en.cityNames;
  const round = Math.floor(index / names.length);
  const base = names[index % names.length];
  return round === 0 ? base : `${base} ${toRoman(round + 1)}`;
}

function toRoman(n: number): string {
  const table: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [value, symbol] of table) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}
