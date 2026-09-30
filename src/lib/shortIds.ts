// A numeração T-/P- mora em api/_lib/shortIds.ts porque o conector do Claude (função da
// Vercel) precisa exatamente do mesmo código — e lá dentro só é seguro importar de api/.
export * from '../../api/_lib/shortIds'
