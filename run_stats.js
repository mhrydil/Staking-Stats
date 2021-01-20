const { ApiPromise, WsProvider } = require('@polkadot/api')
const { isHex } = require('@polkadot/util')

let DOT_DECIMAL_PLACES = 10000000000;
let lowest = "no one";
let lowestNonZeroValidator = "no one";
let highest = "no one";
let highestAmount = NaN;
let lowestAmount = NaN;
let lowestNonZeroAmount = NaN;
let highestCommission = "no one";
let lowestCommission = "no one";
let highestCommissionAmount = NaN;
let lowestCommissionAmount = NaN;
let network = 'polkadot'; // default to polkadot network (can be changed to kusama using command line arg)
let highestMinAmount = NaN;
let highestMinNominator = "no one";
let highestMinAmountNon100 = NaN; // Tracks highest min nomination for non 100% commission validators
let highestMinNominatorNon100 = "no one";
let countNon100 = 0; // Number of non 100% commission validators
let averageMinNomination = NaN; // Average minimum nomination across all validators
let averageMinNominationNon100 = NaN; // Average minimum nomination for non 100% commission validators
let lowestMinStake = NaN;
// let lowestNonZeroMinNominator = "no one";
// let lowestNonZeroMinStake = NaN;
let lowestMinNominator = "no one";

let body  = "";
let summary = "";

(async () => {
  args = process.argv
  let provider = null;
  if (args.length > 2 && args[2] === 'kusama') { // if there is a command line arg for kusama, use kusama network
    body  += 'Connecting to Kusama'
    network = 'kusama'
    provider = new WsProvider('wss://kusama-rpc.polkadot.io')
    DOT_DECIMAL_PLACES *= 100
  }
  else { // default to polkadot
    body  += 'Connecting to Polkadot'
    provider = new WsProvider('wss://rpc.polkadot.io')
  }
  const api = await ApiPromise.create({ provider })
  const [currentValidators, totalIssuance, currentEra] = await Promise.all([
    api.query.session.validators(),
    api.query.balances.totalIssuance(),
    api.query.staking.currentEra(),
  ]);

  const totalKSM = parseInt(totalIssuance.toString())
  const totalBondingStake = await api.query.staking.erasTotalStake(currentEra.toString())

  let averageTotalStake = 0;
  let averageCommission = 0;
  let averageStakeNon100 = 0; // Average stake for validators not taking 100% commission
  let averageCommissionNon100 = 0; // Average commission % for validators not taking 100%
  let totalNominators = 0;
  let uniqueNominators = new Set();




  // first count the number of validators that aren't taking 100% commission (used for finding average commission)
  for (let i=0; i<currentValidators.length; i++){
    const validatorCommissionRate = await api.query.staking.erasValidatorPrefs(currentEra.toString(), currentValidators[i])
    const commissionPercent = parseInt(validatorCommissionRate['commission'].toString()) / 10000000;
    if(commissionPercent < 100){
      countNon100++;
    }
    totalNominators++;

  }


  for (let i = 0; i < currentValidators.length; i++) {
    const validatorStake = await api.query.staking.erasStakers(currentEra.toString(), currentValidators[i])
    const validatorCommissionRate = await api.query.staking.erasValidatorPrefs(currentEra.toString(), currentValidators[i])
    const validatorTotalStake = validatorStake['total'].toString() / DOT_DECIMAL_PLACES
    const validatorOwnStake = validatorStake['own'].toString() / DOT_DECIMAL_PLACES
    const validatorNominators = validatorStake['others'].toJSON()

    check(currentValidators[i].toString(), parseInt(validatorTotalStake), parseInt(validatorCommissionRate['commission'].toString()))

    body  += (`Stash Address: ${currentValidators[i].toString()}.\n\tTotal stake: ${validatorTotalStake}\n\tSelf stake: ${validatorOwnStake} ${getSuffix()}\n`)

    averageTotalStake += validatorTotalStake / currentValidators.length;
    averageCommission += parseInt(validatorCommissionRate['commission'].toString()) / currentValidators.length;
    let thisCommission = parseInt(validatorCommissionRate['commission'].toString()) / 10000000;
    if(thisCommission < 100){
      averageStakeNon100 += validatorTotalStake / countNon100;
      averageCommissionNon100 += thisCommission / countNon100;
    }


    let max = NaN;
    let min = NaN;
    let minNominator = "no one";
    let maxNominator = "no one";
    let avg = 0;
    for (let j = 0; j < validatorNominators.length; j++) {
      body  += (`\tAddress: ${validatorNominators[j].who}, Stake: ${validatorNominators[j].value / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
      if(isNaN(max)) {
        min = max = validatorNominators[j].value;
        minNominator = maxNominator = validatorNominators[j].who;
      }
      else{
        if(validatorNominators[j].value >= max) {
          max = validatorNominators[j].value;
          maxNominator = validatorNominators[j].who;
        }
        if(validatorNominators[j].value <= min) {
          min = validatorNominators[j].value;
          minNominator = validatorNominators[j].who;
        }
      }
      uniqueNominators.add(validatorNominators[j].who);
      avg += (validatorNominators[j].value / validatorNominators.length);
    }



    if(isNaN(averageMinNomination)){
      averageMinNomination = min / totalNominators;
    }
    else{
      averageMinNomination += min/totalNominators;
    }
    checkMinStake(min, minNominator)
    if(thisCommission < 100) {
      checkNon100(min, minNominator)
    }

    if(thisCommission < 100) {
      checkNon100(min, minNominator)
      if(isNaN(averageMinNominationNon100)){
        averageMinNominationNon100 = min / countNon100;
      }
      else{
        averageMinNominationNon100 += min/countNon100;
      }
    }

    body  += (`\tCommission: ${validatorCommissionRate['commission'].toString() / 10000000} %\n`)
    body  += (`\tNominators: ${validatorNominators.length}\n`)
    body  += (`\tMin Nominator: ${minNominator} : ${min / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
    body  += (`\tMax Nominator: ${maxNominator} : ${max / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
    // body  += ('\tMaximum Stake:', max / DOT_DECIMAL_PLACES, getSuffix())
    // body  += ('\tMinimum Stake:', min / DOT_DECIMAL_PLACES, getSuffix())
    body  += (`\tAverage Nominator Stake: ${avg / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  }


  summary += ("\nSummary Data:\n")
  summary += (`\tTotal ${getSuffix()}: ${totalKSM / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  summary += (`\tBonding Stake: ${totalBondingStake.toString() / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  summary += (`\tStaking Rate: ${totalBondingStake.toString() / totalKSM * 100} %\n`)
  summary += (`\tTotal Number of Unique Nominators: ${uniqueNominators.size}\n`)

  summary += (`\tHighest-staked validator: ${highest} : ${highestAmount} ${getSuffix()}\n`)
  summary += (`\tLowest-staked validator: ${lowest} : ${lowestAmount} ${getSuffix()}\n`)
  summary += (`\tLowest-staked(non-zero) validator: ${lowestNonZeroValidator} : ${lowestNonZeroAmount} ${getSuffix()}\n`)
  summary += (`\tHighest commission validator: ${highestCommission} : ${highestCommissionAmount / 10000000} % \n`)
  summary += (`\tLowest commission validator: ${lowestCommission} : ${lowestCommissionAmount / 10000000} %\n`)

  // part 3
  summary += (`\tLowest Minimal Nominator: ${lowestMinNominator} : ${lowestMinStake / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  // summary += (`Lowest Non-Zero Minimal Nominator: ${lowestNonZeroMinNominator} : ${lowestNonZeroMinStake / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  summary += (`\tHighest Minimal Nominator: ${highestMinNominator} : ${highestMinAmount / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  summary += (`\tHighest Minimal Nominator(non 100% commission validators): ${highestMinNominatorNon100} : ${highestMinAmountNon100 / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  summary += (`\tAverage Minimal Nomination: ${averageMinNomination / DOT_DECIMAL_PLACES} ${getSuffix()}\n`);
  summary += (`\tAverage Minimal Nomination (Among Non 100% Commission Validators): ${averageMinNominationNon100 / DOT_DECIMAL_PLACES} ${getSuffix()}\n`);


  // part 4
  summary += (`\tAverage Stake Per Validator: ${averageTotalStake} ${getSuffix()}\n`)
  summary += (`\tAverage Commission: ${averageCommission / 10000000} %\n`)
  summary += (`\tAverage Stake (Among Non 100% Commission Validators): ${averageStakeNon100} ${getSuffix()}\n`)
  summary += (`\tAverage Commission (Among Non 100% Commission Validators): ${averageCommissionNon100} %\n`)


  console.log(body)
  console.log(summary)
  process.exit()
})()


const checkNon100 = (stake, currentNominator) => {
  if(isNaN(stake)){
    return
  }
  if(isNaN(highestMinAmountNon100)) {
    highestMinNominatorNon100 = currentNominator
    highestMinAmountNon100 = stake
  }
  else{
    if(stake > highestMinAmountNon100){
      highestMinAmountNon100 = stake
      highestMinNominatorNon100 = currentNominator
    }
  }
}

const checkMinStake = (stake, currentNominator) => {
  if(isNaN(stake)){
    return;
  }
  if (isNaN(lowestMinStake)) {
    lowestMinStake = highestMinAmount = stake;
    lowestMinNominator = currentNominator;
    highestMinNominator = currentNominator;
  }
  else {
    if (stake < lowestMinStake) {
      lowestMinStake = stake;
      lowestMinNominator = currentNominator;
    }

    else if (stake > highestMinAmount) {
      highestMinAmount = stake;
      highestMinNominator = currentNominator;
    }
  }
}


const check = (currentValidator, stake, commission) => {
  if (isNaN(highestAmount)) {
    // If highest_amount is NaN, this must be the
    // first.  Set this validator to highest and lowest everything.
    lowest = highest = currentValidator
    lowestAmount = highestAmount = stake
    if(stake > 0){
      lowestNonZeroAmount = stake
      lowestNonZeroValidator = stake
    }
    lowestCommission = highestCommission = currentValidator
    lowestCommissionAmount = highestCommissionAmount = commission
  } else {
    // Check total stake

    if (stake > highestAmount) {
      highest = currentValidator
      highestAmount = stake
    } else if (stake < lowestAmount) {
      lowest = currentValidator
      lowestAmount = stake
    }

    // Check if current stake is less than the lowest non-zero stake
    if(stake > 0 && stake < lowestNonZeroAmount){
      lowestNonZeroValidator = currentValidator
      lowestNonZeroAmount = stake
    }

    // Check commissions

    if (commission > highestCommissionAmount) {
      highestCommission = currentValidator
      highestCommissionAmount = commission
    } else if (commission < lowestCommissionAmount) {
      lowestCommission = currentValidator
      lowestCommissionAmount = commission
    }
  }
}

function getSuffix() {
  if (network == 'kusama') return 'KSM';
  else return 'DOT';
}

