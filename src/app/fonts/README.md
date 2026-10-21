# Fontes

`Inter-latin-variable.woff2` — Inter (Google Fonts), **subset latin**, fonte variável
(weight 100–900), 48 KB.

Por que está no repo (e não via `next/font/google`):

- `next/font/google` **baixa a fonte durante o build**. Isso torna o build dependente
  de rede: no Mac do Leo o build quebrava porque `SSL_CERT_FILE` sobrescreve o bundle
  de CAs públicas (o fetch do Google falhava), e no CI/VPS qualquer queda de rede
 during o build derruba o deploy.
- Auto-hospedar deixa o build **hermético**: zero requisição externa.

Licença: Inter é **SIL Open Font License 1.1** — uso, redistribuição e auto-hospedia
permitidos. O arquivo é o mesmo que o Google Fonts entrega para o subset latin.
