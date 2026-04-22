import psycho1 from "./psycho1.png";
import psycho2 from "./psycho2.png";
import psycho3 from "./psycho3.png";
import psycho4 from "./psycho4.png";

const psychologistPhotoMap = {
  "/psychologists/psycho1.png": psycho1,
  "/psychologists/psycho2.png": psycho2,
  "/psychologists/psycho3.png": psycho3,
  "/psychologists/psycho4.png": psycho4,
} as const;

export function resolvePsychologistPhotoUrl(photoUrl: string) {
  return psychologistPhotoMap[photoUrl as keyof typeof psychologistPhotoMap] ?? photoUrl;
}
