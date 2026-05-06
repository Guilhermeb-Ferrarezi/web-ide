interface cartao {
    numero: number
    titular: string
    validade: Date
    bandeira: string
}

interface cartaoFactory {
    criarCartao(numero, titular, validade): cartao
    pagamento(idTransacao, valor, cartao: cartao): void
}

class cartaoVisa implements cartao {
    numero: number
    titular: string
    validade: Date
    bandeira: string
}
class cartaoMasterCard implements cartao {
    numero: number
    titular: string
    validade: Date
    bandeira: string
}

class masterCardFactory implements cartaoFactory {
    criarCartao() {
        let cartao = new cartaoVisa();
        return cartao;
    }

    pagamento(idTransacao: number, valor: number)
    {
        console.log(`pagamento com o id: ${idTransacao} no valor de R$ ${valor}`);
    }
}

class visaFactory implements cartaoFactory {
    criarCartao(numero: number, titular: string, validade: Date) {
        let cartao = new cartaoVisa();
        cartao.numero = numero;
        cartao.titular = titular
        cartao.validade = validade
        return cartao;
    }

    pagamento(idTransacao: number, valor: number, cartao: cartao)
    {
        console.log(`pagamento com o id : ${idTransacao} no valor de R$ ${valor} no cartao do ${cartao.titular}`);
    }
}

const factory: cartaoFactory = new masterCardFactory();
const cartao: cartao = factory.criarCartao(1, "Gui", new Date());

factory.pagamento(1, 50, cartao);