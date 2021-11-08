var settings = {
    loading: true,
    currentNetwork: null,
    tokenType: '',
    trx: {
        hash: '',
        link: '',
    },
    feeAmount: '0',
    agreement: '',
    token: {
        name: '',
        symbol: '',
        decimals: 18,
        cap: '',
        initialBalance: '',
        supplyType: 'Fixed',
        accessType: 'None',
        mintable: false,
        burnable: false,
        operable: false,
        tokenRecover: false,
        removeCopyright: false,
    },
};

async function initDapp() {
    dapp.network.current = dapp.network.list[settings.currentNetwork];
	
	console.log(settings.tokenType);

    try {
        await initWeb3(settings.currentNetwork, true);
        initService(settings.currentNetwork);
        await loadToken();
    } catch (e) {
        console.log(e);
        sendNotify('danger', e.message);
    }
}

async function loadToken() {
    if (!Object.prototype.hasOwnProperty.call(dapp.tokenList, settings.tokenType)) {
        sendNotify('danger', 'Selected token type does not exist!');

        settings.tokenType = 'SimpleBEP20';
    }

    initToken(settings.tokenType);

    updateTokenDetails();
    updateSupply();
    updateCap();

    try {
        settings.feeAmount = await promisify(dapp.contracts.service.methods.getPrice(settings.tokenType).call);
    } catch (e) {
        console.log(e.message);

        if (settings.currentNetwork === 'mainnet') {
            sendNotify('warning', 'We are having an issue with Current Network Provider. Please switch Network or try again later.');
            settings.feeAmount = web3.utils.toWei('0', 'ether');
        } else {
            settings.feeAmount = web3.utils.toWei(`${settings.token.price}`, 'ether');
        }
    }

    $('#tokenFee').html(web3.utils.fromWei(settings.feeAmount, 'ether'));

    gtagSend('view_item', {
        items: [{
            name: settings.tokenType
        }]
    });

    $('#formLoading').hide();
    $('#createTokenForm').show();
}

async function generateToken() {
    if (!dapp.metamask.installed) {
        sendNotify('danger', 'To create a Token please install MetaMask!');
        return;
    } else {
        if (dapp.metamask.netId !== dapp.network.current.id) {
            sendNotify('danger', 'Your MetaMask in the wrong network. Please switch on ' + dapp.network.current.name + ' and try again!');
            return;
        }
    }

    try {
        settings.trx.hash = '';
        settings.trx.link = '';

        gtagSend('add_to_cart', {
            currency: 'USD',
            items: [{
                name: settings.tokenType
            }],
            value: settings.feeAmount
        });

        await window.ethereum.request({ method: 'eth_requestAccounts' });

        const tokenContract = new web3.eth.Contract(dapp.contracts.token.abi);

        const deployOptions = {
            data: dapp.contracts.token.bytecode,
            arguments: getDeployArguments(),
        };

        const sendOptions = {
            from: await promisify(web3.eth.getCoinbase),
            value: settings.feeAmount,
            gasPrice: '10000000000', // default gas price 10 gwei
        };

        sendOptions.gas = await estimateDeployGas(tokenContract, deployOptions, sendOptions);

        console.log(sendOptions);

        tokenContract.deploy(deployOptions)
            .send(sendOptions)
            .on('error', (error) => {
                console.log(error);

                $('#createTokenForm').show();
                $('#creatingToken').hide();

                sendNotify('danger', error.message);
            })
            .on('transactionHash', (transactionHash) => {
                console.log(transactionHash);

                settings.trx.hash = transactionHash;
                settings.trx.link = `${dapp.network.current.explorerLink}/tx/${settings.trx.hash}`;

                $('#loadingTx').hide();
                $('#txFound').show();
                $('#txIdLink').attr('href', settings.trx.link);
                $('#txId').html(settings.trx.hash);
            })
            .on('receipt', (receipt) => {
                console.log(receipt);

                settings.token.address = receipt.contractAddress;
                settings.token.link = dapp.network.current.explorerLink + '/token/' + settings.token.address;

                $('#tokenAddressLoading').hide();
                $('#tokenAddressFound').show();
                $('#myTokenName').html(settings.token.name);
                $('#myTokenInitBalance').html(settings.token.initialBalance);
                $('.myTokenSymbol').html(settings.token.symbol);
                $('#myTokenAddress').html(settings.token.address);
                $('#tokenLink').attr('href', settings.token.link);

                sendNotify('success', 'Your token has been deployed!');

                gtagSend('purchase', {
                    currency: 'USD',
                    transaction_id: settings.trx.hash,
                    value: settings.feeAmount,
                    items: [{
                        name: settings.tokenType
                    }]
                });
            });
    } catch (e) {
        $('#createTokenForm').show();
        $('#creatingToken').hide();

        sendNotify('danger', e.message);
    }
}

function updateTokenDetails() {
    const detail = tokenDetails.find((elem) => elem.name === settings.tokenType);

    settings.token.supplyType = detail.supplyType;

    $('#tokenSupplyType').val(detail.supplyType);
    $('#tokenAccessType').val(detail.accessType);

    $('#tokenVerifiedSource').prop('checked', detail.verified);
    $('#tokenRemoveCopyright').prop('checked', detail.removeCopyright);
    $('#tokenMintable').prop('checked', detail.mintable);
    $('#tokenBurnable').prop('checked', detail.burnable);
    $('#tokenOperable').prop('checked', detail.operable);
    $('#tokenRecover').prop('checked', detail.tokenRecover);

    $('#tokenDecimals').prop('disabled', !detail.customizeDecimals);
    $('#tokenDecimals').val(detail.customizeDecimals ? settings.token.decimals : 18);

    settings.token.price = detail.price;
    settings.token.gas = web3.utils.toBN(detail.gas);

    settings.token.decimals = detail.customizeDecimals ? settings.token.decimals : 18;
}

function updateCap() {
    settings.token.cap = ['100k', 'Fixed'].includes(settings.token.supplyType) ? settings.token.initialBalance : settings.token.cap;

    var tokenCapDisabled = ['100k', 'Fixed'].includes(settings.token.supplyType) ? true : false;

    $('#tokenCap').prop('disabled', tokenCapDisabled);

    $('#tokenCapDiv').toggle(settings.token.supplyType !== 'Unlimited');

    $('#tokenCap').val(settings.token.cap);
}

function updateSupply() {
    settings.token.initialBalance = settings.token.supplyType === '100k' ? 100000 : settings.token.initialBalance;

    $('#tokenInitialSupply').prop('disabled', settings.token.supplyType === '100k');

    $('#tokenInitialSupply').val(settings.token.initialBalance);
}

function getDeployArguments() {
    const name = $('#tokenName').val();
    const symbol = $('#tokenSymbol').val();
    const decimals = web3.utils.toBN($('#tokenDecimals').val());
    const cap = web3.utils.toBN($('#tokenCap').val()).mul(web3.utils.toBN(Math.pow(10, $('#tokenDecimals').val())));
    const initialBalance = web3.utils.toBN($('#tokenInitialSupply').val()).mul(web3.utils.toBN(Math.pow(10, $('#tokenDecimals').val())));

    const params = [name, symbol];

    switch (settings.tokenType) {
        case 'HelloBEP20':
            // nothing else
            break;
        case 'SimpleBEP20':
            params.push(initialBalance);
            break;
        case 'StandardBEP20':
        case 'BurnableBEP20':
        case 'UnlimitedBEP20':
        case 'AmazingBEP20':
            params.push(decimals);
            params.push(initialBalance);
            break;
        case 'MintableBEP20':
        case 'CommonBEP20':
            params.push(decimals);
            params.push(cap);
            params.push(initialBalance);
            break;
        default:
            throw new Error(
                'Invalid Token Type',
            );
    }

    params.push(dapp.contracts.service.options.address);

    return params;
}

async function estimateDeployGas(tokenContract, deployOptions, sendOptions) {
    try {
        const gas = await promisify(tokenContract.deploy(deployOptions).estimateGas, sendOptions);

        return web3.utils.toBN(gas).muln(1.3); // add 30% tolerance
    } catch (e) {
        console.log('estimateDeploy');
        console.log(e);

        return settings.token.gas;
    }
}

async function addToMetaMask() {
    try {
        await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: settings.token.address,
                    symbol: settings.token.symbol.substr(0, 5),
                    decimals: settings.token.decimals,
                },
            },
        });
    } catch (e) {
        console.log(e);
    }
}

//init
settings.tokenType = getParam('tokenType') || 'SimpleBEP20';
settings.currentNetwork = getParam('network') || dapp.network.default;
await initDapp();

$('#tokenType').val(settings.tokenType);
$('#tokenNetwork').val(settings.currentNetwork);
$('#testnetAlert').toggle(settings.currentNetwork === 'testnet');

if (!dapp.metamask.installed) {
    $('#metamaskInstall').show();
}

$('#tokenType').on('change', function () {
    settings.tokenType = $('#tokenType').val() || 'SimpleBEP20';

    loadToken();
});

$('#tokenNetwork').on('change', function () {
    settings.currentNetwork = $('#tokenNetwork').val();

    $('#testnetAlert').toggle(settings.currentNetwork === 'testnet');

    initDapp();
});

$('#tokenInitialSupply').on('keyup change', function () {
    if ($('#tokenCap').prop('disabled')) {
        $('#tokenCap').val($(this).val());
    }
});

$('#addToMetaMask').on('click', function() {
    addToMetaMask();
});

$('form').on('submit', function (e) {
    e.preventDefault();
    

    $('#createTokenForm').hide();
    $('#creatingToken').show();

    settings.token.name = $('#tokenName').val();
    settings.token.symbol = $('#tokenSymbol').val();

    generateToken();
});