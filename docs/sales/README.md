# Materiais comerciais — Convlyx

Reset comercial de outubro de 2026. Decisões em [`docs/decisions/2026-10-08-go-to-market-reset.md`](../decisions/2026-10-08-go-to-market-reset.md).

| Ficheiro | Para quê | Para quem |
|---|---|---|
| `01-plano-comercial.pdf` | Diagnóstico, posicionamento, canais, semana-tipo, plano de 90 dias, metas | Interno (nós) |
| `02-guioes-e-mensagens.docx` | Todos os guiões e mensagens prontos a copiar: reconquista, visita, email, WhatsApp, telefone, objeções, parcerias | Interno |
| `03-folheto-escolas-fundadoras.pdf` | Folheto A4 de uma página para deixar nas visitas ou enviar por WhatsApp/email | Escolas |
| `04-precos-2026.pdf` | Tabela de preços com FAQ | Escolas |
| `05-ficha-de-adesao.pdf` | Ficha de adesão de uma página (substitui o contrato de 4 páginas) | Escolas |
| `06-leads-centro.xlsx` | CRM: escolas da região Centro com contactos, sinais e prioridade, mais modelos de email, config e painel | Interno |
| `automacao/convlyx-crm.gs` | Apps Script que envia as sequências de email a partir do Gmail, deteta respostas e envia um resumo diário | Interno |

## Regenerar os PDFs

Os PDFs 01, 03, 04 e 05 são gerados a partir dos HTML em `_src/`:

```bash
pip install qrcode pillow
# editar _src/config.json (nomes, telemóveis, email, destino do QR)
python docs/sales/_src/build.py            # todos
python docs/sales/_src/build.py folheto    # só um
```

O script precisa do Microsoft Edge ou do Google Chrome (usa o modo headless para imprimir para PDF).

## Pôr o CRM a funcionar (10 min)

1. Carregar `06-leads-centro.xlsx` para o Google Drive e abrir com o Google Sheets (*Ficheiro → Guardar como Google Sheets*).
2. *Extensões → Apps Script*, colar `automacao/convlyx-crm.gs` e guardar.
3. Recarregar a folha e escolher *Convlyx → Instalar automação diária*.
4. Preencher o separador **Config** (email, nome, terra e assinatura de cada um; ID do folheto no Drive).
5. Para pôr uma escola na sequência de email: *Estado = "Em sequência"*, *Responsável* e *Ângulo* preenchidos.

O script deteta as respostas no mesmo fio de email. Se uma escola responder a partir de outro endereço ou de um email novo, mudem o Estado à mão.

## Fontes da pesquisa de mercado (8 out 2026)

- Portaria 185/2015 (registo eletrónico, dispositivos): https://pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=2434&tabela=leis
- IMT, dispositivos de monitorização certificados: https://www.imt-ip.pt/escolas-de-conducao-e-entidades-formadoras/dispositivos-de-monitorizacao-do-ensino-pratico-certificados/
- AGE/AGEOnline (Interage): https://ensinaraconduzir.pt/plataforma-online/ · https://ensinaraconduzir.pt/gestao/
- ALSIS ER-Sigestec: https://www.alsis.pt/
- Gesdriver/Gescola: http://www.gesdriver.com/ · BDrive (ANIECA): https://bdrive.pt/
- AMT, nota estatística sobre as escolas de condução (2024): https://observatorio.amt-autoridade.pt/
- AMT, relatório de reclamações do 2.º semestre de 2025: https://www.amt-autoridade.pt/media/5949/relatorio-reclamacoes_2s-2025.pdf
- Reclamações (DGC), Executive Digest, 30/06/2026: https://executivedigest.sapo.pt/reclamacoes-contra-escolas-de-conducao-aceleram-e-quase-igualam-total-do-ano-passado/
- ANIECA, congresso de 16–17/10/2026: https://site.anieca.pt/circular-51-26-xx-congresso-da-anieca-liderar-o-futuro-valorizar-os-profissionais-do-ensino-da-conducao-convite/
- DL 112/2026 (tutor): https://prp.pt/conducao-com-tutor/
- Referência de preços em Espanha: https://autogest.es/ · https://winautogest.com/ · https://iamess.com/
- Lista de escolas do IMT de 2021 (volumes de exames): https://www.imt-ip.pt/wp-content/uploads/2025/01/EscolasdeConducao-2021.pdf
