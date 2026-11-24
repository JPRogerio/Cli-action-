import express from 'express';
import pg from 'pg';
import cors from 'cors';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

// Configuração da conexão com o PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT)
});

// =========================================================================
// ROTAS DE CLIENTES (GET, POST, PUT, DELETE)
// =========================================================================
app.get('/api/clientes', async (req, res) => {
    try {
        const query = `
      SELECT id, cpf, nome, email, telefone,
             TO_CHAR(data_nasc, 'YYYY-MM-DD') AS "dataNasc",
             sexo, mkt_email AS "mktEmail", mkt_whats AS "mktWhats",
             mkt_ligacao AS "mktLigacao", preferencia
      FROM clientes ORDER BY id ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clientes', async (req, res) => {
    const { cpf, nome, email, telefone, dataNasc, sexo, mktEmail, mktWhats, mktLigacao, preferencia } = req.body;
    try {
        const query = `
      INSERT INTO clientes (cpf, nome, email, telefone, data_nasc, sexo, mkt_email, mkt_whats, mkt_ligacao, preferencia)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, cpf, nome, email, telefone, TO_CHAR(data_nasc, 'YYYY-MM-DD') AS "dataNasc",
                sexo, mkt_email AS "mktEmail", mkt_whats AS "mktWhats", mkt_ligacao AS "mktLigacao", preferencia`;
        const values = [cpf, nome, email, telefone, dataNasc || null, sexo, mktEmail, mktWhats, mktLigacao, preferencia];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    const { cpf, nome, email, telefone, dataNasc, sexo, mktEmail, mktWhats, mktLigacao, preferencia } = req.body;
    try {
        const query = `
      UPDATE clientes
      SET cpf=$1, nome=$2, email=$3, telefone=$4, data_nasc=$5, sexo=$6,
          mkt_email=$7, mkt_whats=$8, mkt_ligacao=$9, preferencia=$10
      WHERE id=$11
      RETURNING id, cpf, nome, email, telefone, TO_CHAR(data_nasc, 'YYYY-MM-DD') AS "dataNasc",
                sexo, mkt_email AS "mktEmail", mkt_whats AS "mktWhats", mkt_ligacao AS "mktLigacao", preferencia`;
        const values = [cpf, nome, email, telefone, dataNasc || null, sexo, mktEmail, mktWhats, mktLigacao, preferencia, id];
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
        res.json({ message: 'Cliente removido com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// ROTAS DE VENDAS (GET, POST)
// =========================================================================
app.get('/api/vendas', async (req, res) => {
    try {
        const query = `
      SELECT id, id_cliente AS "idCliente", TO_CHAR(data, 'YYYY-MM-DD') AS data,
             produto, valor, forma_pagamento AS "formaPagamento", funcionario
      FROM vendas ORDER BY id ASC`;
        const result = await pool.query(query);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/vendas', async (req, res) => {
    const { idCliente, data, produto, valor, formaPagamento, funcionario } = req.body;
    try {
        const query = `
      INSERT INTO vendas (id_cliente, data, produto, valor, forma_pagamento, funcionario)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, id_cliente AS "idCliente", TO_CHAR(data, 'YYYY-MM-DD') AS data,
                produto, valor, forma_pagamento AS "formaPagamento", funcionario`;
        const values = [idCliente, data, produto, valor, formaPagamento, funcionario];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// =========================================================================
// ROTAS DE MANIFESTAÇÕES (GET, POST, PATCH/INICIAR, PUT/FINALIZAR)
// =========================================================================

// 1. Listar todas as manifestações
app.get('/api/manifestacoes', async (req, res) => {
    try {
        const query = `
      SELECT id, id_cliente AS "idCliente", id_pedido AS "idPedido",
             TO_CHAR(data_registro, 'YYYY-MM-DD') AS "dataRegistro",
             COALESCE(TO_CHAR(data_finalizacao, 'YYYY-MM-DD'), '-') AS "dataFinalizacao",
             TO_CHAR(prazo, 'YYYY-MM-DD') AS prazo,
             tipo, meio, texto, classificacao,
             funcionario_envolvido AS "funcionarioEnvolvido",
             responsavel, parecer_gerente AS "parecerGerente",
             status, autorizado_retorno AS "autorizadoRetorno"
      FROM manifestacoes ORDER BY id ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Registrar nova manifestação (nasce como 'Em Aberto')
app.post('/api/manifestacoes', async (req, res) => {
    const {
        idCliente, idPedido, dataRegistro, prazo, tipo, meio, texto,
        classificacao, funcionarioEnvolvido, responsavel, status, autorizadoRetorno
    } = req.body;

    try {
        const query = `
      INSERT INTO manifestacoes (
        id_cliente, id_pedido, data_registro, prazo, tipo, meio, texto,
        classificacao, funcionario_envolvido, responsavel, parecer_gerente, status, autorizado_retorno
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, '', $11, $12)
      RETURNING id, id_cliente AS "idCliente", id_pedido AS "idPedido",
                TO_CHAR(data_registro, 'YYYY-MM-DD') AS "dataRegistro",
                '-' AS "dataFinalizacao",
                TO_CHAR(prazo, 'YYYY-MM-DD') AS prazo,
                tipo, meio, texto, classificacao,
                funcionario_envolvido AS "funcionarioEnvolvido",
                responsavel, parecer_gerente AS "parecerGerente",
                status, autorizado_retorno AS "autorizadoRetorno"`;
        const values = [
            idCliente, idPedido || null, dataRegistro, prazo, tipo, meio, texto,
            classificacao, funcionarioEnvolvido, responsavel, status || 'Em Aberto', autorizadoRetorno
        ];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Mudar status de 'Em Aberto' para 'Em Tratamento'
app.patch('/api/manifestacoes/:id/iniciar', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
      UPDATE manifestacoes
      SET status = 'Em Tratamento'
      WHERE id = $1
      RETURNING id, id_cliente AS "idCliente", id_pedido AS "idPedido",
                TO_CHAR(data_registro, 'YYYY-MM-DD') AS "dataRegistro",
                COALESCE(TO_CHAR(data_finalizacao, 'YYYY-MM-DD'), '-') AS "dataFinalizacao",
                TO_CHAR(prazo, 'YYYY-MM-DD') AS prazo,
                tipo, meio, texto, classificacao,
                funcionario_envolvido AS "funcionarioEnvolvido",
                responsavel, parecer_gerente AS "parecerGerente",
                status, autorizado_retorno AS "autorizadoRetorno"`;
        const result = await pool.query(query, [id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Finalizar manifestação com Parecer do Gerente
app.put('/api/manifestacoes/:id/finalizar', async (req, res) => {
    const { id } = req.params;
    const { dataFinalizacao, responsavel, parecerGerente } = req.body;
    try {
        const query = `
      UPDATE manifestacoes
      SET status = 'Finalizado',
          data_finalizacao = $1,
          responsavel = $2,
          parecer_gerente = $3
      WHERE id = $4
      RETURNING id, id_cliente AS "idCliente", id_pedido AS "idPedido",
                TO_CHAR(data_registro, 'YYYY-MM-DD') AS "dataRegistro",
                TO_CHAR(data_finalizacao, 'YYYY-MM-DD') AS "dataFinalizacao",
                TO_CHAR(prazo, 'YYYY-MM-DD') AS prazo,
                tipo, meio, texto, classificacao,
                funcionario_envolvido AS "funcionarioEnvolvido",
                responsavel, parecer_gerente AS "parecerGerente",
                status, autorizado_retorno AS "autorizadoRetorno"`;
        const values = [dataFinalizacao, responsavel, parecerGerente, id];
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.listen(3001, () => {
    console.log('Servidor rodando na porta 3001');
});
