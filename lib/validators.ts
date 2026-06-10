import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  display_name: z.string().min(2, 'Nome muito curto').max(50),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const petSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(40),
  species: z.enum(['dog', 'cat', 'bird', 'rabbit', 'reptile', 'rodent', 'fish', 'other']),
  breed: z.string().max(60).optional().or(z.literal('')),
  birthdate: z.string().optional().or(z.literal('')),
  bio: z.string().max(200).optional().or(z.literal('')),
  avatar_url: z.string().url().optional().or(z.literal('')),
  // Campos da carteirinha — todos opcionais, declarados pelo tutor
  microchip_number: z.string().max(40).optional().or(z.literal('')),
  rga_number: z.string().max(40).optional().or(z.literal('')),
  blood_type: z.string().max(20).optional().or(z.literal('')),
  allergies: z.string().max(200).optional().or(z.literal('')),
  known_conditions: z.string().max(200).optional().or(z.literal('')),
  emergency_contact_name: z.string().max(80).optional().or(z.literal('')),
  emergency_contact_phone: z.string().max(30).optional().or(z.literal('')),
  preferred_vet_name: z.string().max(80).optional().or(z.literal('')),
  preferred_vet_phone: z.string().max(30).optional().or(z.literal('')),
  // SinPatinhas — RG federal do MMA (voluntário)
  sinpatinhas_id: z.string().max(60).optional().or(z.literal('')),
});
export type PetInput = z.infer<typeof petSchema>;

export const postSchema = z.object({
  caption: z.string().max(500).optional().or(z.literal('')),
});
export type PostInput = z.infer<typeof postSchema>;

export const meetupSchema = z.object({
  title: z.string().min(3, 'Título muito curto').max(80),
  description: z.string().max(500).optional().or(z.literal('')),
  location_name: z.string().min(2, 'Informe o local').max(120),
  starts_at: z.string().min(1, 'Informe data e horário'),
});
export type MeetupInput = z.infer<typeof meetupSchema>;
