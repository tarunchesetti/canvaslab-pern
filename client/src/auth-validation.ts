export function passwordsMatch(password: string, confirmation: string): boolean {
  return password.length > 0 && password === confirmation
}
