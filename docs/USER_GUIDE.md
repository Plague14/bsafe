# BSafe - Guia do Usuário

## O que é o BSafe?

BSafe é uma carteira multisig non-custodial na blockchain Solana com funcionalidade de **herança digital**. Permite que você:

- Crie cofres seguros (Vaults) para guardar seus SOL
- Configure múltiplos assinantes para aprovar transações (Multisig)
- Defina beneficiários que receberão seus ativos automaticamente
- Configure triggers automáticos (Deadman Switch) ou manuais (Certidão de Óbito)

---

## Passo a Passo Completo

### Passo 1: Conectar sua Carteira

1. Acesse o BSafe em `http://localhost:5173` (desenvolvimento) ou o domínio de produção
2. Clique no botão **"Conectar Carteira"** no canto superior direito
3. Selecione sua carteira (Phantom, Solflare, etc.)
4. Aprove a conexão na extensão da carteira
5. Certifique-se de estar na rede **Devnet** para testes

> **Dica:** Para testes, você pode obter SOL grátis em https://faucet.solana.com

---

### Passo 2: Criar um Vault

1. No Dashboard, clique em **"Criar Vault"** ou acesse **Vaults** no menu lateral
2. Clique em **"Criar Vault"**
3. Digite um nome para o vault (ex: "Cofre Principal")
4. Clique em **"Criar Vault"**
5. Aprove a transação na sua carteira
6. Aguarde a confirmação na blockchain

```
┌─────────────────────────────────────────┐
│  Criar Novo Vault                       │
├─────────────────────────────────────────┤
│  Nome do Vault: [Cofre Principal    ]   │
│                                         │
│  O que é um Vault?                      │
│  • Cofre seguro para guardar seus SOL   │
│  • Pode ser configurado com multisig    │
│  • Permite adicionar beneficiários      │
│                                         │
│         [Cancelar]  [Criar Vault]       │
└─────────────────────────────────────────┘
```

---

### Passo 3: Depositar SOL no Vault

1. Na página de **Vaults**, encontre seu vault criado
2. Clique em **"Depositar"**
3. Digite a quantidade de SOL que deseja depositar
4. Clique em **"Depositar"**
5. Aprove a transação na sua carteira
6. O saldo será atualizado após confirmação

```
┌─────────────────────────────────────────┐
│  Depositar em Cofre Principal           │
├─────────────────────────────────────────┤
│  Quantidade (SOL): [1.5            ]    │
│                                         │
│  Vault Treasury: 7xKXt...AsU            │
│  Saldo atual: 0.0000 SOL                │
│  Taxa estimada: ~0.000005 SOL           │
│                                         │
│         [Cancelar]  [Depositar]         │
└─────────────────────────────────────────┘
```

---

### Passo 4: Adicionar Beneficiários

1. Acesse **Herdeiros** no menu lateral
2. Selecione o vault desejado no dropdown
3. Clique em **"Adicionar"**
4. Preencha:
   - **Endereço da Carteira:** A carteira Solana do beneficiário
   - **Porcentagem:** Quanto ele receberá (1-100%)
5. Clique em **"Adicionar"**
6. Repita para cada beneficiário

```
Exemplo de distribuição:
┌──────────────────────────────────────────┐
│  Beneficiário         │  Porcentagem     │
├───────────────────────┼──────────────────┤
│  7xKXt...gAsU (Filho) │     50%          │
│  9bYZr...hKmP (Filha) │     30%          │
│  3cWQs...jLnR (Esposa)│     20%          │
├───────────────────────┼──────────────────┤
│  TOTAL                │    100%          │
└──────────────────────────────────────────┘
```

> **Importante:** A soma das porcentagens deve ser **exatamente 100%** para criar o plano de herança.

---

### Passo 5: Editar Porcentagens (se necessário)

1. Na página de **Herdeiros**, clique no ícone de edição (lápis) ao lado do beneficiário
2. Ajuste a porcentagem usando o slider ou digitando o valor
3. O sistema mostra o total em tempo real
4. Clique em **"Salvar"** quando a soma for 100%

```
┌─────────────────────────────────────────┐
│  Editar Porcentagem                     │
├─────────────────────────────────────────┤
│  Beneficiário: 7xKXt...gAsU             │
│                                         │
│  Nova Porcentagem: [50] %               │
│  ──────────●──────────────              │
│                                         │
│  Valor estimado: 0.7500 SOL             │
│  Total: 100.0%  ✓                       │
│                                         │
│         [Cancelar]  [Salvar]            │
└─────────────────────────────────────────┘
```

---

### Passo 6: Criar Plano de Herança

1. Acesse **Plano de Herança** no menu lateral
2. Verifique os requisitos:
   - ✅ Beneficiários cadastrados
   - ✅ Alocação completa (100%)
3. Clique em **"Criar Plano de Herança"**
4. Configure:

| Configuração | Descrição | Valores |
|--------------|-----------|---------|
| **Tipo de Trigger** | Como a herança será ativada | Híbrido (recomendado), Deadman Switch, ou Certidão |
| **Período de Cooldown** | Tempo para cancelar após ativação | 1-365 dias |
| **Deadman Switch** | Período de inatividade que ativa | 30 dias - 5 anos |
| **Verificações** | Quantas pessoas confirmam a certidão | 1-10 |

5. Clique em **"Criar Plano"**
6. Aprove a transação

```
Configuração recomendada:
┌─────────────────────────────────────────┐
│  Tipo: Híbrido (Deadman + Certidão)     │
│  Cooldown: 30 dias                      │
│  Deadman Switch: 365 dias (1 ano)       │
│  Verificações: 2 pessoas                │
└─────────────────────────────────────────┘
```

---

## Como Funciona a Herança

### Fluxo Completo

```
                    OWNER VIVO
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   Interação       Inatividade      Falecimento
   Regular         Prolongada
        │               │               │
        │               ▼               ▼
        │         Deadman Switch   Certidão de
        │         (automático)     Óbito + Verificação
        │               │               │
        │               └───────┬───────┘
        │                       │
        │                       ▼
        │              HERANÇA INICIADA
        │                       │
        │                       ▼
        │              ┌─────────────────┐
        │              │ COOLDOWN        │
        │              │ (30 dias)       │
        │              │                 │
        │              │ Owner pode      │
        └──────────────│ CANCELAR        │
                       │ (Provar Vida)   │
                       └────────┬────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
              Owner Cancela          Cooldown Expira
                    │                       │
                    ▼                       ▼
             Vault Reativado        CLAIM LIBERADO
                                           │
                                           ▼
                                   Beneficiários
                                   sacam suas partes
```

### Tipos de Trigger

| Trigger | Como funciona | Quando usar |
|---------|---------------|-------------|
| **Deadman Switch** | Ativa automaticamente se você não interagir com o vault por X dias | Para quem viaja muito ou pode ficar incomunicável |
| **Certidão de Óbito** | Beneficiário submete documento, verificadores confirmam | Processo mais seguro e imediato |
| **Híbrido** | Ambos os métodos | Máxima flexibilidade (recomendado) |

### Período de Cooldown

- Após a herança ser ativada, você tem um período para **cancelar**
- Cancelar = "Provar Vida" - mostra que você ainda está vivo
- Se não cancelar dentro do prazo, os beneficiários podem sacar

---

## Para Beneficiários

### Como Receber sua Herança

1. Conecte a carteira que foi cadastrada como beneficiário
2. Acesse **Plano de Herança**
3. Se a herança estiver pronta, você verá:
   - Sua porcentagem
   - Valor a receber em SOL
   - Botão **"Clamar Herança"**
4. Clique em **"Clamar Herança"**
5. Aprove a transação
6. Os SOL serão transferidos diretamente para sua carteira

```
┌─────────────────────────────────────────┐
│  Você pode clamar sua herança!          │
├─────────────────────────────────────────┤
│                                         │
│  Sua parte: 50%                         │
│  Valor a receber: 0.7500 SOL            │
│                                         │
│         [Clamar Herança]                │
└─────────────────────────────────────────┘
```

---

## Perguntas Frequentes (FAQ)

### Segurança

**P: Meus SOL estão seguros?**
R: Sim! O BSafe é non-custodial - apenas você (ou seus beneficiários após o trigger) pode movimentar os fundos. Tudo é controlado por smart contracts auditáveis na blockchain.

**P: E se eu perder minha carteira?**
R: Se você perder acesso à sua carteira principal, o Deadman Switch eventualmente ativará a herança para seus beneficiários. É importante ter backups da sua seed phrase.

### Configuração

**P: Posso mudar os beneficiários depois?**
R: Sim, você pode adicionar, remover ou editar porcentagens a qualquer momento enquanto o vault estiver ativo.

**P: E se a soma não der 100%?**
R: O frontend bloqueia a criação do plano até que a soma seja exatamente 100%. Isso garante que todos os fundos sejam distribuídos.

**P: Posso ter múltiplos vaults?**
R: Sim! Você pode criar quantos vaults quiser, cada um com seus próprios beneficiários e configurações.

### Herança

**P: O que acontece se eu interagir com o vault?**
R: O timestamp de "última atividade" é atualizado, reiniciando o contador do Deadman Switch.

**P: Posso cancelar uma herança já iniciada?**
R: Sim, durante o período de cooldown. Após o cooldown, não é mais possível cancelar.

---

## Rede e Taxas

| Item | Valor |
|------|-------|
| **Rede** | Solana Devnet (testes) / Mainnet (produção) |
| **Taxa de transação** | ~0.000005 SOL (~$0.001) |
| **Tempo de confirmação** | ~400ms |

---

## Suporte

- **GitHub:** https://github.com/seu-usuario/bsafe
- **Discord:** [Link do Discord]
- **Email:** suporte@bsafe.app

---

*Built for Colosseum Hackathon 2026*
