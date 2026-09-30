// A numeração T-/P- mora em shared/ porque as funções do servidor (functions/) usam
// exatamente o mesmo código para numerar — os dois lados precisam chegar aos mesmos IDs.
export * from '../../shared/shortIds'
