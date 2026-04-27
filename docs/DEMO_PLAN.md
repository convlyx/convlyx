# Plano de Demonstração — Convlyx

Demo curta (~15 min) seguida de teste real da app pelo cliente. Foco nos pontos altos — depois eles exploram sozinhos.

---

## Abertura conjunta (1 min)

**Francisco:**
> "Vamos mostrar-vos rapidamente o Convlyx. Cada escola tem o seu próprio espaço — um subdomínio só dela — e dentro dele há três tipos de utilizadores: pessoal administrativo, instrutores e alunos. Eu mostro como a escola é gerida, e depois o [parceiro] mostra-vos como funciona para os alunos e instrutores."

---

## Parte 1 — Backoffice (Francisco, ~7 min)

Foco: gestão diária + multi-tenancy + automatização. Não entrar em todas as opções — destacar o que torna o produto especial.

### 1. Login e painel (1 min)
- Mostrar URL da escola: `escola.convlyx.com`
- "Cada escola tem o seu próprio subdomínio. Os dados ficam isolados — nunca vê dados de outra escola."
- Login → painel com estatísticas
- "Em três segundos a secretária sabe o que está a acontecer hoje."

### 2. Calendário e detalhe de aula (2 min)
- Calendário com aulas (azul = teórica, verde = prática)
- Clicar numa aula em curso ou já concluída → detalhe
- Mostrar lista de alunos + marcar presenças (Presente/Faltou)
- "Marcar todos presentes" — demonstrar
- "Adicionar aluno" — mostrar a lista com checkboxes + "Selecionar todos"
- "Imaginem uma teórica com 25 alunos — não vamos escrever um a um."

### 3. Criar aula recorrente (1.5 min)
- Botão "Criar aula"
- Mostrar criação recorrente (dias da semana + intervalo de datas)
- "Numa escola de condução, as teóricas das segundas e quartas repetem-se durante meses. Em vez de criar 50 aulas, crio uma vez."
- Detecção de conflitos: tentar duplicar instrutor → erro
- "Não posso colocar o mesmo instrutor em duas aulas ao mesmo tempo."

### 4. Editar instrutor de uma aula (1 min)
- Editar uma aula → trocar instrutor
- "Se um instrutor cai doente, mudo aqui e os alunos recebem notificação push automaticamente — sem chamadas, sem mensagens manuais."

### 5. QR de instalação (1 min)
- Definições → QR de instalação
- "Cada escola tem o seu próprio QR. Imprimem, põem no balcão, e os alunos instalam a app no telemóvel — sem App Store, sem fricção."
- Mostrar a página `/install` rapidamente (uma aba já preparada)
- "Detecta iPhone ou Android e mostra as instruções certas."

### 6. Notificações e push (30 seg)
- Sino com histórico
- "Tudo o que muda — aulas canceladas, mudanças de horário, presenças marcadas — fica registado aqui. E chega como push notification ao telemóvel."

### Transição
> "Há muito mais aqui dentro — alunos, instrutores, inscrições, exportação de PDFs — mas vão descobrir tudo isso quando experimentarem. Agora vamos ver o telemóvel."

---

## Parte 2 — Aluno e Instrutor (parceiro, ~6 min)

Foco: a experiência mobile-first. Mostrar como a app é fluida no telemóvel.

### 1. Vista do Aluno — Painel (1.5 min)
- App aberta no telemóvel (ou Chrome em modo mobile)
- Saudação personalizada por hora do dia
- Hero card: próxima aula com contagem decrescente ao vivo
- Card de progresso com percentagem de presenças
- "O aluno abre a app e em meio segundo sabe quando é a próxima aula e como está o seu progresso."

### 2. Inscrição numa aula (1 min)
- Tab Aulas
- "Limpa, só mostra aulas em que o aluno se pode inscrever — sem aulas passadas, sem aulas em que já está inscrito, sem aulas cheias."
- Tocar em "Inscrever" → push notification chega no momento
- "Inscrição confirmada, recebe a notificação. Tudo automático."

### 3. Histórico — Inscrições (1 min)
- Tab Inscrições com aulas passadas e futuras
- Estados: Presente, Faltou, Inscrito, Sem registo
- "Se a aula passou e ninguém marcou a presença, mostra 'Sem registo' em vez de assumir que o aluno faltou. É justo."

### 4. Vista do Instrutor — Painel (1.5 min)
- Logout, login como instrutor
- Hero card com aula em curso a pulsar
- Timeline do dia
- "O instrutor olha e sabe exatamente onde tem de estar."

### 5. Marcar presenças e cancelar aula (1 min)
- Tocar numa aula → marcar presenças
- Mostrar "Não posso dar esta aula"
- "Se um instrutor adoece de manhã, em três toques cancela a aula e os alunos sabem antes de saírem de casa."

---

## Encerramento (1 min)

**Francisco:**
> "Para resumir: multi-tenant, mobile-first, push notifications integradas, instalação por QR. Tudo em português europeu, sem App Store, atualizações imediatas."

**Parceiro:**
> "Agora vão experimentar. Têm credenciais de admin, instrutor e aluno — explorem à vontade, e qualquer dúvida estamos aqui."

---

## Notas práticas

- **Antes da demo:**
  - Preparar dados realistas: 5-10 alunos, 3-4 instrutores, aulas espalhadas pelos próximos dias e algumas no passado
  - Ter abas separadas para cada papel (admin/instrutor/aluno) para alternar rapidamente
  - Ativar push notifications nas contas de demo (telemóvel + browser)
- **Dispositivos:**
  - Computador a apresentar o backoffice
  - Telemóvel real (mirror para projector se possível) para a parte do aluno/instrutor
- **Contas de teste a entregar no fim:**
  - 1 admin
  - 1-2 instrutores
  - 3-4 alunos
- **Plano B se a internet falhar:** screenshots do fluxo crítico (calendário, detalhe da aula, painel do aluno)
- **Tempo total:** ~15 min demo + Q&A + tempo livre para experimentarem
