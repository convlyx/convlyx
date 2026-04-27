# Plano de Demonstração — Convlyx

Demo curta (~15 min) seguida de teste real da app pelo cliente. Foco nos pontos altos — depois eles exploram sozinhos.

> **Regra de ouro:** durante a demo, **mostrar mas evitar submissões reais que disparem cascatas** (cancelar aulas, mudar instrutor, marcar indisponibilidade). Abrir o modal/diálogo, mostrar a confirmação, e cancelar antes de submeter. Os clientes vão experimentar a sério a seguir nos seus próprios dados.
>
> Ações **seguras de fazer ao vivo**: marcar presenças (reversíveis), adicionar aluno a uma aula de teste, inscrever-se como aluno numa aula preparada para isso.

---

## Abertura conjunta (1 min)

**Francisco:**
> "Vamos mostrar-vos rapidamente o Convlyx. Cada escola tem o seu próprio espaço — um subdomínio só dela — e dentro dele há três tipos de utilizadores: pessoal administrativo, instrutores e alunos. Eu mostro como a escola é gerida, e depois o [parceiro] mostra-vos como funciona para os alunos e instrutores."

---

## Parte 1 — Backoffice (Francisco, ~7 min)

Foco: gestão diária + multi-tenancy + automatização.

### 1. Login e painel (1 min)
- Mostrar URL da escola: `escola.convlyx.com`
- "Cada escola tem o seu próprio subdomínio. Os dados ficam isolados — nunca vê dados de outra escola."
- Login → painel com estatísticas
- "Em três segundos a secretária sabe o que está a acontecer hoje."

### 2. Calendário e detalhe de aula (2 min)
- Calendário com aulas (azul = teórica, verde = prática)
- Clicar numa aula em curso ou já concluída → detalhe
- ✅ **Fazer ao vivo:** marcar uma presença individual (Presente/Faltou) — reversível
- ✅ **Fazer ao vivo:** "Marcar todos presentes" numa aula de demo preparada
- ✅ **Fazer ao vivo:** "Adicionar aluno" — mostrar a lista com checkboxes + "Selecionar todos", confirmar a inscrição
- "Imaginem uma teórica com 25 alunos — não vamos escrever um a um."

### 3. Criar aula recorrente (1.5 min)
- Botão "Criar aula"
- Preencher os dados de criação recorrente (dias da semana + intervalo de datas)
- "Numa escola de condução, as teóricas das segundas e quartas repetem-se durante meses. Em vez de criar 50 aulas, crio uma vez."
- ✅ **Fazer ao vivo:** detecção de conflitos — tentar criar uma aula que sobreponha um instrutor existente → mostrar erro de conflito
- ⚠️ **Não submeter** a criação recorrente final — só mostrar o formulário preenchido. "Submetemos depois quando vocês fizerem nas vossas escolas."

### 4. Editar uma aula (1 min)
- Abrir o modal de editar uma aula
- Mostrar que pode trocar o instrutor / horário
- ⚠️ **Não guardar** — fechar o modal. "Quando guardo, os alunos inscritos recebem push notification imediatamente — sem chamadas, sem mensagens manuais. Vamos saltar a submissão para não estragar os dados de teste."

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

Foco: a experiência mobile-first.

### 1. Vista do Aluno — Painel (1.5 min)
- App aberta no telemóvel (ou Chrome em modo mobile)
- Saudação personalizada por hora do dia
- Hero card: próxima aula com contagem decrescente ao vivo
- Card de progresso com percentagem de presenças
- "O aluno abre a app e em meio segundo sabe quando é a próxima aula e como está o seu progresso."

### 2. Inscrição numa aula (1 min)
- Tab Aulas
- "Limpa, só mostra aulas em que o aluno se pode inscrever — sem aulas passadas, sem aulas em que já está inscrito, sem aulas cheias."
- ✅ **Fazer ao vivo:** tocar em "Inscrever" numa aula de demo preparada → push notification chega no momento
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

### 5. Marcar presenças e indisponibilidade (1 min)
- Tocar numa aula → marcar presenças
- ✅ **Fazer ao vivo:** marcar uma presença num aluno
- Mostrar o botão "Não posso dar esta aula"
- ⚠️ **Abrir o diálogo de confirmação mas cancelar.** "Se confirmar, a aula é cancelada e todos os alunos inscritos recebem push notification automaticamente. Em três toques o instrutor resolve. Vamos saltar a confirmação."

---

## Encerramento (1 min)

**Francisco:**
> "Para resumir: multi-tenant, mobile-first, push notifications integradas, instalação por QR. Tudo em português europeu, sem App Store, atualizações imediatas."

**Parceiro:**
> "Agora vão experimentar. Têm credenciais de admin, instrutor e aluno — explorem à vontade, e qualquer dúvida estamos aqui."

---

## Notas práticas

### Estratégia de demo segura
- **Submeter ao vivo apenas:** marcar presença, adicionar aluno a uma aula de teste, inscrever um aluno numa aula preparada. Tudo reversível.
- **Não submeter (mostrar o formulário e cancelar):** criar aula recorrente, editar/guardar uma aula, mudar instrutor, cancelar aula, marcar instrutor indisponível.
- **Razão:** se algo falhar ou se acidentalmente cancelarmos uma aula que precisamos para o resto da demo, parecemos amadores. Os clientes podem fazer tudo a sério a seguir.

### Antes da demo (preparação dos dados)
- **Aulas dedicadas a cada cenário:**
  - 1 aula em curso com 4-5 alunos para "marcar presenças" e "marcar todos presentes"
  - 1 aula concluída com algumas presenças marcadas para mostrar histórico
  - 1 aula futura com vagas livres e o aluno de demo NÃO inscrito (para a inscrição ao vivo)
  - 1 aula futura à hora que o instrutor já tem outra (para mostrar conflito)
- **Utilizadores:** 5-10 alunos, 3-4 instrutores, distribuídos pelas aulas
- **Push notifications ativadas** nas contas de demo (telemóvel + browser)
- **Abas separadas** abertas para cada papel para alternar rapidamente

### Dispositivos
- Computador a apresentar o backoffice (sidebar visível)
- Telemóvel real (mirror para projector se possível) para a parte do aluno/instrutor

### Contas de teste a entregar no fim
- 1 admin
- 1-2 instrutores
- 3-4 alunos

### Plano B
Se a internet falhar: screenshots do fluxo crítico (calendário, detalhe da aula, painel do aluno) numa pasta acessível offline.

### Tempo total
~15 min demo + Q&A + tempo livre para experimentarem.
