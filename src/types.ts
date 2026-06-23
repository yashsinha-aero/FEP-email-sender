export interface Recipient {
  id: string;
  [key: string]: string;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface SentStatus {
  [id: string]: boolean;
}
