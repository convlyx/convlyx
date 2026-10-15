/**
 * Convlyx CRM — automação de sequências de email sobre Google Sheets + Gmail. Custo: 0 €.
 *
 * INSTALAÇÃO (10 minutos, uma vez por pessoa que envia):
 *   1. Carregar 06-leads-centro.xlsx para o Google Drive → Abrir com Google Sheets
 *      (Ficheiro → Guardar como Google Sheets).
 *   2. Na folha: Extensões → Apps Script → apagar o conteúdo → colar este ficheiro → Guardar.
 *   3. Recarregar a folha. Aparece o menu "Convlyx". Correr "Convlyx → Instalar automação diária"
 *      e aceitar as permissões (Gmail + Sheets + Drive).
 *   4. No separador "Config", preencher o vosso email, nome, terra e assinatura.
 *
 * COMO FUNCIONA:
 *   - Uma linha entra na sequência quando o Estado passa a "Em sequência" e tem Email.
 *   - Todos os dias às ~9h (só nos dias definidos em Config → DIAS_ENVIO) o script:
 *       a) verifica se alguma escola respondeu → Estado "Respondeu" e a sequência para;
 *       b) envia o passo seguinte (C1 → C2 → C3 → C4) às linhas cujo "Próximo envio" já chegou;
 *       c) envia-vos um resumo do dia com as respostas e as tarefas (visitas, chamadas).
 *   - Cada pessoa só envia as linhas em que é "Responsável" (pelo nome em Config).
 *   - Os textos vêm do separador "Modelos" — editem lá, sem tocar no código.
 *   - Limite diário (Config → MAX_POR_DIA) para respeitar as quotas do Gmail e não parecer spam.
 */

const SHEET_LEADS = 'Leads';
const SHEET_MODELOS = 'Modelos';
const SHEET_CONFIG = 'Config';

// Passo atual → [modelo a enviar, dias até ao passo seguinte, enviar no mesmo fio?]
const SEQUENCIA = {
  1: { modelo: null, proximoEmDias: 3, mesmoFio: false }, // modelo C1 escolhido pelo "Ângulo"
  2: { modelo: 'C2', proximoEmDias: 5, mesmoFio: true },
  3: { modelo: 'C3', proximoEmDias: 7, mesmoFio: false, anexarFolheto: true },
  4: { modelo: 'C4', proximoEmDias: 7, mesmoFio: true },
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Convlyx')
    .addItem('Enviar passos pendentes agora', 'correrAgora')
    .addItem('Só verificar respostas', 'verificarRespostas')
    .addItem('Pré-visualizar o próximo email da linha selecionada', 'previsualizar')
    .addSeparator()
    .addItem('Instalar automação diária', 'instalarTrigger')
    .addItem('Remover automação diária', 'removerTrigger')
    .addToUi();
}

// ---------------------------------------------------------------- triggers

function instalarTrigger() {
  removerTrigger();
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(9).nearMinute(30).create();
  SpreadsheetApp.getUi().alert('Automação instalada: corre todos os dias por volta das 9h30.');
}

function removerTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'rotinaDiaria')
    .forEach((t) => ScriptApp.deleteTrigger(t));
}

function rotinaDiaria() {
  const cfg = lerConfig();
  const hoje = new Date();
  const diasEnvio = String(cfg.DIAS_ENVIO || '2,3,4').split(',').map((d) => Number(d.trim()));
  const respostas = verificarRespostas();
  let enviados = [];
  if (diasEnvio.indexOf(hoje.getDay()) !== -1) enviados = enviarPendentes(cfg);
  enviarResumo(cfg, respostas, enviados);
}

function correrAgora() {
  const cfg = lerConfig();
  const respostas = verificarRespostas();
  const enviados = enviarPendentes(cfg);
  SpreadsheetApp.getUi().alert(
    `Respostas novas: ${respostas.length}\nEmails enviados: ${enviados.length}` +
      (enviados.length ? '\n\n' + enviados.join('\n') : ''),
  );
}

// ---------------------------------------------------------------- núcleo

function enviarPendentes(cfg) {
  const { sheet, rows, col } = lerLeads();
  const eu = meuNome(cfg);
  const max = Number(cfg.MAX_POR_DIA || 25);
  const hoje = inicioDoDia(new Date());
  const modelos = lerModelos();
  const enviados = [];

  for (let i = 0; i < rows.length && enviados.length < max; i++) {
    const r = rows[i];
    if (r[col['Estado']] !== 'Em sequência') continue;
    if (!r[col['Email']]) continue;
    if (eu && r[col['Responsável']] && r[col['Responsável']] !== eu) continue;

    const passoFeito = Number(r[col['Passo seq']] || 0);
    const proximo = r[col['Próximo envio']];
    if (passoFeito > 0 && proximo && inicioDoDia(new Date(proximo)) > hoje) continue;

    const linha = i + 2;
    if (passoFeito >= 4) {
      // Sequência terminada sem resposta → arrefecer 3 meses
      sheet.getRange(linha, col['Estado'] + 1).setValue('Arrefecer');
      sheet.getRange(linha, col['Data próxima ação'] + 1).setValue(somarDias(hoje, 90));
      sheet.getRange(linha, col['Próxima ação'] + 1).setValue('Voltar a contactar (reconquista)');
      continue;
    }

    const passo = passoFeito + 1;
    const def = SEQUENCIA[passo];
    const chave = def.modelo || 'C1-' + (r[col['Ângulo']] || 'telefone');
    const modelo = modelos[chave];
    if (!modelo) throw new Error(`Modelo "${chave}" não existe no separador Modelos.`);

    const vars = variaveis(r, col, cfg);
    const assunto = preencher(modelo.assunto, vars);
    const corpo = preencher(modelo.corpo, vars) + rodape(cfg);
    const html = corpo.split('\n').map((l) => (l ? escapeHtml(l) : '')).join('<br>');
    const opcoes = { htmlBody: html, name: eu || undefined };
    if (def.anexarFolheto && cfg.FOLHETO_DRIVE_ID) {
      opcoes.attachments = [DriveApp.getFileById(cfg.FOLHETO_DRIVE_ID).getBlob()];
    }

    // Os seguimentos "no mesmo fio" vão com "Re: <assunto do 1.º email>" para o destinatário
    // (thread.reply() responderia a nós próprios, porque a última mensagem do fio é nossa).
    const assuntoC1 = preencher(modelos['C1-' + (r[col['Ângulo']] || 'telefone')].assunto, vars);
    const assuntoFinal = def.mesmoFio ? 'Re: ' + assuntoC1 : assunto;
    GmailApp.sendEmail(r[col['Email']], assuntoFinal, corpo, opcoes);
    Utilities.sleep(1500);
    const found = GmailApp.search(`to:${r[col['Email']]} in:sent newer_than:1d`, 0, 1);
    const ids = String(r[col['Thread ID']] || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (found.length && ids.indexOf(found[0].getId()) === -1) ids.push(found[0].getId());

    sheet.getRange(linha, col['Passo seq'] + 1).setValue(passo);
    sheet.getRange(linha, col['Último contacto'] + 1).setValue(new Date());
    sheet.getRange(linha, col['Próximo envio'] + 1).setValue(somarDias(hoje, def.proximoEmDias));
    sheet.getRange(linha, col['Thread ID'] + 1).setValue(ids.join(','));
    enviados.push(`${r[col['Escola']]} — passo ${passo} (${chave})`);
  }
  return enviados;
}

function verificarRespostas() {
  const { sheet, rows, col } = lerLeads();
  const meusEmails = [Session.getActiveUser().getEmail()].concat(GmailApp.getAliases()).map((e) => e.toLowerCase());
  const novas = [];
  rows.forEach((r, i) => {
    if (r[col['Estado']] !== 'Em sequência') return;
    const respondeu = String(r[col['Thread ID']] || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .some((id) => {
        try {
          return GmailApp.getThreadById(id)
            .getMessages()
            .some((m) => {
              const de = m.getFrom().toLowerCase();
              return !meusEmails.some((e) => de.indexOf(e) !== -1);
            });
        } catch (e) {
          return false;
        }
      });
    if (respondeu) {
      const linha = i + 2;
      sheet.getRange(linha, col['Estado'] + 1).setValue('Respondeu');
      sheet.getRange(linha, col['Próxima ação'] + 1).setValue('Responder hoje e marcar visita');
      sheet.getRange(linha, col['Data próxima ação'] + 1).setValue(inicioDoDia(new Date()));
      novas.push(r[col['Escola']]);
    }
  });
  return novas;
}

function enviarResumo(cfg, respostas, enviados) {
  const { rows, col } = lerLeads();
  const eu = meuNome(cfg);
  const hoje = inicioDoDia(new Date());
  const tarefas = rows
    .filter((r) => r[col['Data próxima ação']] && inicioDoDia(new Date(r[col['Data próxima ação']])) <= hoje)
    .filter((r) => !eu || !r[col['Responsável']] || r[col['Responsável']] === eu)
    .filter((r) => ['Cliente', 'Perdido'].indexOf(r[col['Estado']]) === -1)
    .map((r) => `• ${r[col['Escola']]} (${r[col['Concelho']]}): ${r[col['Próxima ação']] || '—'}`);
  if (!respostas.length && !enviados.length && !tarefas.length) return;
  const corpo = [
    respostas.length ? `RESPOSTAS NOVAS (responder hoje):\n• ${respostas.join('\n• ')}` : '',
    tarefas.length ? `TAREFAS PARA HOJE:\n${tarefas.join('\n')}` : '',
    enviados.length ? `EMAILS ENVIADOS HOJE (${enviados.length}):\n• ${enviados.join('\n• ')}` : '',
    `\nFolha: ${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  GmailApp.sendEmail(Session.getActiveUser().getEmail(), `Convlyx · resumo de ${formatarData(hoje)}`, corpo);
}

function previsualizar() {
  const cfg = lerConfig();
  const { sheet, rows, col } = lerLeads();
  const linha = sheet.getActiveRange().getRow();
  if (linha < 2) return;
  const r = rows[linha - 2];
  const passo = Number(r[col['Passo seq']] || 0) + 1;
  if (passo > 4) return SpreadsheetApp.getUi().alert('Sequência já terminada nesta linha.');
  const def = SEQUENCIA[passo];
  const chave = def.modelo || 'C1-' + (r[col['Ângulo']] || 'telefone');
  const m = lerModelos()[chave];
  const vars = variaveis(r, col, cfg);
  SpreadsheetApp.getUi().alert(
    `Passo ${passo} · ${chave}\n\nAssunto: ${preencher(m.assunto, vars)}\n\n${preencher(m.corpo, vars)}${rodape(cfg)}`,
  );
}

// ---------------------------------------------------------------- utilitários

function lerLeads() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEADS);
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const col = {};
  header.forEach((h, i) => (col[String(h).trim()] = i));
  ['Estado', 'Email', 'Responsável', 'Passo seq', 'Próximo envio', 'Último contacto', 'Thread ID', 'Ângulo', 'Escola',
   'Próxima ação', 'Data próxima ação', 'Concelho'].forEach((c) => {
    if (col[c] === undefined) throw new Error(`Falta a coluna "${c}" no separador Leads.`);
  });
  return { sheet, rows: values.slice(1), col };
}

function lerModelos() {
  const values = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MODELOS).getDataRange().getValues();
  const out = {};
  values.slice(1).forEach((r) => {
    if (r[0]) out[String(r[0]).trim()] = { assunto: String(r[1] || ''), corpo: String(r[2] || '') };
  });
  return out;
}

function lerConfig() {
  const values = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG).getDataRange().getValues();
  const cfg = {};
  values.slice(1).forEach((r) => {
    if (r[0]) cfg[String(r[0]).trim()] = r[1];
  });
  return cfg;
}

/** Nome de quem está a correr o script, a partir do email (Config → EMAIL_<Nome>). */
function meuNome(cfg) {
  const email = Session.getActiveUser().getEmail().toLowerCase();
  const k = Object.keys(cfg).find((key) => key.indexOf('EMAIL_') === 0 && String(cfg[key]).toLowerCase() === email);
  return k ? k.replace('EMAIL_', '') : '';
}

function variaveis(r, col, cfg) {
  const eu = meuNome(cfg) || String(r[col['Responsável']] || '');
  const contacto = String(r[col['Contacto']] || '').trim();
  return {
    escola: r[col['Escola']] || '',
    grupo: r[col['Grupo']] || r[col['Escola']] || '',
    concelho: r[col['Concelho']] || '',
    nome: contacto ? contacto.split(' ')[0] : '',
    remetente: eu,
    terra: cfg['TERRA_' + eu] || '',
    assinatura: cfg['ASSINATURA_' + eu] || '',
  };
}

function preencher(texto, vars) {
  let out = String(texto);
  Object.keys(vars).forEach((k) => (out = out.split('{' + k + '}').join(vars[k])));
  // "Bom dia {nome}," sem nome → "Bom dia,"
  return out.replace(/ ,/g, ',').replace(/\s+\n/g, '\n');
}

function rodape(cfg) {
  return cfg.RODAPE ? '\n\n' + cfg.RODAPE : '';
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inicioDoDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function somarDias(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function formatarData(d) {
  return Utilities.formatDate(d, 'Europe/Lisbon', 'dd/MM/yyyy');
}
