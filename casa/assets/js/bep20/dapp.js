/* global config, settings */

var dapp = {
    web3: null,
    web3Provider: null,
    metamask: {
        installed: false,
        netId: null,
    },
    network: {
        default: config.defaultNetwork,
        current: null,
        map: {
            56: 'mainnet',
            97: 'testnet',
        },
        list: {
            mainnet: {
                web3Provider: 'https://bsc-dataseed.binance.org/',
                explorerLink: 'https://bscscan.com',
                id: 56,
                name: 'Binance Smart Chain',
            },
            testnet: {
                web3Provider: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
                explorerLink: 'https://testnet.bscscan.com',
                id: 97,
                name: 'Binance Smart Chain - Testnet',
            },
        },
    },
    serviceReceiver: config.serviceReceiver,
    tokenList: {
        HelloBEP20,
        SimpleBEP20,
        StandardBEP20,
        BurnableBEP20,
        MintableBEP20,
        CommonBEP20,
        UnlimitedBEP20,
        AmazingBEP20
    },
    contracts: {
        token: null,
        service: null,
    },
};

var web3 = null;

// Append options to token type select
Object.keys(dapp.tokenList).forEach(elm => $('#tokenType').append(new Option(dapp.tokenList[elm].contractName, dapp.tokenList[elm].contractName)));

async function initWeb3(network, checkWeb3) {
    if (!Object.prototype.hasOwnProperty.call(dapp.network.list, network)) {
        throw new Error(
            `Failed initializing network ${network}. Allowed values are ${Object.keys(dapp.network.list)}.`,
        );
    }

    if (checkWeb3 && (typeof window.ethereum !== 'undefined')) {
        console.log('injected bsc'); // eslint-disable-line no-console
        dapp.web3Provider = window.ethereum;

        web3 = new Web3(dapp.web3Provider);
        dapp.metamask.installed = dapp.web3Provider.isMetaMask;

        const netId = await promisify(web3.eth.getChainId);
        dapp.metamask.netId = netId;

        if (netId !== dapp.network.list[network].id) {
            dapp.network.current = dapp.network.list[dapp.network.map[netId]];
            await this.initWeb3(network, false);
        }
    } else {
        console.log('provided bsc'); // eslint-disable-line no-console
        dapp.network.current = dapp.network.list[network];
        dapp.web3Provider = new Web3.providers.HttpProvider(dapp.network.list[network].web3Provider);
        web3 = new Web3(dapp.web3Provider);
    }
}

function initService(network) {
    dapp.contracts.service = new web3.eth.Contract(
        ServiceReceiverArtifact.abi,
        dapp.serviceReceiver[network],
    );
}

function initToken(tokenType) {
    dapp.contracts.token = dapp.tokenList[tokenType];
    dapp.contracts.token.stringifiedAbi = JSON.stringify(dapp.contracts.token.abi);
}