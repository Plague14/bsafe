# BSafe - Modelos de Monetização

## Visão Geral

O BSafe pode ser monetizado de diferentes formas. Abaixo estão as opções analisadas com prós, contras e implementação técnica.

---

## Opção 1: Taxa sobre Herança (Claim Fee)

### Como funciona
Cobra uma porcentagem quando o beneficiário faz o claim da herança.

```
Vault: 10 SOL
Taxa BSafe: 1%
───────────────────
Beneficiário recebe: 9.9 SOL
BSafe recebe: 0.1 SOL
```

### Prós
- ✅ Usuário só paga quando realmente usa o serviço
- ✅ Alinhado com o valor entregue (herança executada com sucesso)
- ✅ Receita recorrente conforme mais heranças são executadas
- ✅ Sem barreira de entrada

### Contras
- ❌ Receita só vem a longo prazo (quando pessoas morrem/triggers ativam)
- ❌ Difícil prever fluxo de caixa

### Implementação Técnica
```rust
// No smart contract, durante o claim:
let fee_bps = 100; // 1% = 100 basis points
let fee_amount = claim_amount * fee_bps / 10000;
let net_amount = claim_amount - fee_amount;

// Transferir fee para treasury do BSafe
**bsafe_treasury.try_borrow_mut_lamports()? += fee_amount;
**claimer.try_borrow_mut_lamports()? += net_amount;
```

### Taxa Sugerida
- **0.5% - 2%** do valor herdado

---

## Opção 2: Taxa de Criação de Vault

### Como funciona
Cobra uma taxa única quando o usuário cria um vault.

```
Criar Vault: 0.05 SOL
(taxa única)
```

### Prós
- ✅ Receita imediata
- ✅ Previsível
- ✅ Incentiva usuários comprometidos

### Contras
- ❌ Barreira de entrada
- ❌ Pode afastar usuários que querem testar
- ❌ Receita única, não recorrente

### Implementação Técnica
```rust
// No smart contract, durante create_vault:
let vault_creation_fee = 50_000_000; // 0.05 SOL in lamports

// Transferir para treasury BSafe
invoke(
    &system_instruction::transfer(
        &ctx.accounts.owner.key(),
        &ctx.accounts.bsafe_treasury.key(),
        vault_creation_fee,
    ),
    &[...],
)?;
```

### Taxa Sugerida
- **0.01 - 0.1 SOL** por vault

---

## Opção 3: Assinatura (SaaS)

### Como funciona
Cobrança mensal/anual para usar o serviço.

```
Plano Básico:  Grátis  (1 vault, 3 beneficiários)
Plano Pro:     $9/mês  (5 vaults, 10 beneficiários, multisig)
Plano Premium: $29/mês (ilimitado, suporte prioritário)
```

### Prós
- ✅ Receita recorrente previsível
- ✅ Permite diferentes níveis de serviço
- ✅ Modelo SaaS tradicional, investidores entendem

### Contras
- ❌ Complexo de implementar on-chain
- ❌ Precisa de backend para gerenciar assinaturas
- ❌ Usuários podem não querer pagar mensalidade
- ❌ Vai contra a filosofia "non-custodial"

### Implementação
- Requer backend off-chain para gerenciar pagamentos
- Pode usar Stripe/crypto payments
- Smart contract verifica se usuário tem assinatura ativa

---

## Opção 4: Taxa sobre Depósitos

### Como funciona
Cobra uma pequena porcentagem quando o usuário deposita no vault.

```
Depósito: 10 SOL
Taxa: 0.5%
───────────────────
Vault recebe: 9.95 SOL
BSafe recebe: 0.05 SOL
```

### Prós
- ✅ Receita imediata
- ✅ Proporcional ao valor depositado
- ✅ Simples de implementar

### Contras
- ❌ Pode desincentivar depósitos grandes
- ❌ Usuário "perde" dinheiro na entrada
- ❌ Competidores sem taxa podem atrair usuários

### Taxa Sugerida
- **0.1% - 0.5%** do depósito

---

## Opção 5: Freemium + Premium Features

### Como funciona
Funcionalidades básicas grátis, cobra por features avançadas.

```
GRÁTIS:
- 1 vault
- 3 beneficiários
- Deadman switch básico

PREMIUM (pagamento único 0.5 SOL):
- Vaults ilimitados
- 10 beneficiários por vault
- Multisig completo
- Múltiplos verificadores
- Suporte prioritário
```

### Prós
- ✅ Sem barreira de entrada
- ✅ Usuários podem testar antes de pagar
- ✅ Pagamento único (mais atrativo que assinatura)

### Contras
- ❌ Precisa definir bem o que é free vs premium
- ❌ Usuários podem ficar no plano grátis para sempre

### Implementação
```rust
// Verificar se usuário tem NFT premium ou pagou upgrade
let is_premium = verify_premium_status(&ctx.accounts.owner)?;

if !is_premium && vault.beneficiary_count >= 3 {
    return Err(BsafeError::PremiumRequired.into());
}
```

---

## Opção 6: Híbrido (Recomendado)

### Como funciona
Combina múltiplos modelos para maximizar receita e acessibilidade.

```
┌─────────────────────────────────────────────────────┐
│  MODELO HÍBRIDO BSAFE                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. CRIAÇÃO GRÁTIS                                  │
│     - Sem barreira de entrada                       │
│     - Atrai usuários                                │
│                                                     │
│  2. TAXA DE CLAIM: 1%                               │
│     - Só paga quando herança é executada            │
│     - Alinhado com valor entregue                   │
│                                                     │
│  3. PREMIUM OPCIONAL: 0.5 SOL (único)               │
│     - Remove taxa de claim                          │
│     - Vaults ilimitados                             │
│     - Features extras                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Fluxo de Receita
```
Usuário novo
    │
    ▼
Cria vault GRÁTIS ──────────────────┐
    │                               │
    ▼                               │
Usa normalmente                     │
    │                               │
    ▼                               │
Herança ativada                     │
    │                               │
    ├───────────────┐               │
    ▼               ▼               │
Usuário FREE    Usuário PREMIUM     │
    │               │               │
    ▼               ▼               │
Paga 1% taxa    Sem taxa            │
    │               │               │
    ▼               ▼               │
BSafe recebe    BSafe já recebeu ◄──┘
receita         0.5 SOL no upgrade
```

---

## Recomendação Final

Para o hackathon e lançamento inicial:

### Fase 1: MVP (Hackathon)
- **Grátis total** - foco em adoção e feedback
- Mostrar potencial de monetização no pitch

### Fase 2: Beta
- **Taxa de claim 1%** - simples, justo, alinhado com valor

### Fase 3: Produção
- **Modelo híbrido** - freemium + taxa de claim + premium

---

## Implementação da Taxa de Claim (Sugerida)

Se quiser implementar agora, a mudança no smart contract seria:

```rust
// Em claim.rs

pub const BSAFE_FEE_BPS: u16 = 100; // 1%
pub const BSAFE_TREASURY: Pubkey = pubkey!("BSAFE_TREASURY_ADDRESS");

pub fn claim_inheritance(ctx: Context<ClaimInheritance>) -> Result<()> {
    // ... código existente ...

    // Calcular fee
    let fee_amount = (claim_amount as u128 * BSAFE_FEE_BPS as u128 / 10000) as u64;
    let net_amount = claim_amount - fee_amount;

    // Transferir para beneficiário
    **ctx.accounts.vault_treasury.try_borrow_mut_lamports()? -= claim_amount;
    **ctx.accounts.claimer.try_borrow_mut_lamports()? += net_amount;

    // Transferir fee para BSafe
    **ctx.accounts.bsafe_treasury.try_borrow_mut_lamports()? += fee_amount;

    // ... resto do código ...
}
```

---

## Qual modelo você prefere?

1. **Taxa de Claim (1%)** - Simples, justo
2. **Taxa de Criação** - Receita imediata
3. **Freemium** - Grátis básico, pago avançado
4. **Híbrido** - Combinação dos modelos
5. **Grátis** - Foco em adoção primeiro

