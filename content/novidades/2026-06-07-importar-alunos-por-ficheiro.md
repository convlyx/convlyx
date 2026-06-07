---
title: "Importar alunos a partir de um ficheiro"
date: 2026-06-07
audience: [ADMIN, SECRETARY]
summary: "Adicione vários alunos de uma só vez a partir de um ficheiro Excel ou CSV, com mapeamento de colunas e validação antes de confirmar."
---

Já não é preciso criar os alunos um a um. Na página de alunos, o botão **"Importar alunos"** abre um assistente em quatro passos:

1. **Carregar** um ficheiro `.xlsx`, `.xls` ou `.csv`.
2. **Associar as colunas** do ficheiro aos campos (nome, email, telemóvel, categoria). Sem modelo rígido: a Convlyx tenta detetá-las automaticamente.
3. **Pré-visualizar** numa tabela com validação linha a linha (emails inválidos ou repetidos, dados em falta), corrigindo o que for preciso ali mesmo.
4. **Confirmar**: cada aluno importado recebe o convite por email.

Pode definir uma **categoria por omissão** para as linhas sem categoria, e os emails já existentes são tratados de forma inteligente (ignorados se ativos, reativados se inativos). Uma linha com erro nunca interrompe a importação das restantes.
