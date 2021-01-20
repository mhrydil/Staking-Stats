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

let stats = {};
let body  = {};
let summary = {};

(async () => {
  args = process.argv
  let provider = null;
  if (args.length > 2 && args[2] === 'kusama') { // if there is a command line arg for kusama, use kusama network
    body['network'] = 'Kusama'
    network = 'kusama'
    provider = new WsProvider('wss://kusama-rpc.polkadot.io')
    DOT_DECIMAL_PLACES *= 100
  }
  else { // default to polkadot
    body['network'] = 'Polkadot'
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

  let validatorList = []


  for (let i = 0; i < currentValidators.length; i++) {
    const validatorStake = await api.query.staking.erasStakers(currentEra.toString(), currentValidators[i])
    const validatorCommissionRate = await api.query.staking.erasValidatorPrefs(currentEra.toString(), currentValidators[i])
    const validatorTotalStake = validatorStake['total'].toString() / DOT_DECIMAL_PLACES
    const validatorOwnStake = validatorStake['own'].toString() / DOT_DECIMAL_PLACES
    const validatorNominators = validatorStake['others'].toJSON()

    check(currentValidators[i].toString(), parseInt(validatorTotalStake), parseInt(validatorCommissionRate['commission'].toString()))

    let thisValidator = {}
    thisValidator['Stash Address'] = currentValidators[i].toString()
    thisValidator['Total Stake'] = validatorTotalStake
    thisValidator['Self Stake'] = validatorOwnStake

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
    
    let nominatorList = []

    for (let j = 0; j < validatorNominators.length; j++) {
      let thisNominator = {}
      thisNominator['Address'] = validatorNominators[j].who
      thisNominator['Stake'] = validatorNominators[j].value / DOT_DECIMAL_PLACES
      nominatorList.push(thisNominator)
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
    
    thisValidator['Nominators'] = nominatorList



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
    thisValidator['Commission'] = `${ validatorCommissionRate['commission'].toString() / 10000000 } %`
    thisValidator['Nominator Count'] = validatorNominators.length
    let minNominatorDict = {}
    minNominatorDict['Address'] = minNominator
    minNominatorDict['Stake'] = min / DOT_DECIMAL_PLACES
    thisValidator['Min Nominator'] = minNominatorDict
    let maxNominatorDict = {}
    maxNominatorDict['Address'] = maxNominator
    maxNominatorDict['Stake'] = max / DOT_DECIMAL_PLACES
    thisValidator['Max Nominator'] = maxNominatorDict
    thisValidator['Average Stake'] = avg / DOT_DECIMAL_PLACES

    validatorList.push(thisValidator)
  }

  body['Validators'] = validatorList


  // summary += ("\nSummary Data:\n")
  // summary += (`\tTotal ${getSuffix()}: ${totalKSM / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  summary['Era'] = currentEra
  summary['Total ' + getSuffix()] = `${totalKSM / DOT_DECIMAL_PLACES} ${getSuffix()}`;
  // summary += (`\tBonding Stake: ${totalBondingStake.toString() / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  summary['Bonding Stake'] = `${totalBondingStake.toString() / DOT_DECIMAL_PLACES} ${getSuffix()}`;
  // summary += (`\tStaking Rate: ${totalBondingStake.toString() / totalKSM * 100} %\n`)
  summary['Staking Rate'] = `${totalBondingStake.toString() / totalKSM * 100} %`;
  // summary += (`\tTotal Number of Unique Nominators: ${uniqueNominators.size}\n`)
  summary['Unique Nominators'] = uniqueNominators.size;

  // summary += (`\tHighest-staked validator: ${highest} : ${highestAmount} ${getSuffix()}\n`)
  validatorStats = {}

  highValidator = {}
  highValidator['addr'] = highest
  highValidator['value'] = highestAmount
  validatorStats['Highest Staked Validator'] = highValidator

  // summary += (`\tLowest-staked validator: ${lowest} : ${lowestAmount} ${getSuffix()}\n`)
  lowValidator = {}
  lowValidator['addr'] = lowest
  lowValidator['value'] = lowestAmount
  validatorStats['Lowest Staked Validator'] = lowValidator

  // summary += (`\tLowest-staked(non-zero) validator: ${lowestNonZeroValidator} : ${lowestNonZeroAmount} ${getSuffix()}\n`)
  lowValidatorNZ = {}
  lowValidatorNZ['addr'] = lowestNonZeroValidator
  lowValidatorNZ['value'] = lowestNonZeroAmount
  validatorStats['Lowest Staked(non-zero) Validator'] = lowValidatorNZ
  // summary += (`\tHighest commission validator: ${highestCommission} : ${highestCommissionAmount / 10000000} % \n`)
  highValidatorComm = {}
  highValidatorComm['addr'] = highestCommission
  highValidatorComm['value'] = `${highestCommissionAmount / 10000000} %`
  validatorStats['Highest Commission Validator'] = highValidatorComm
  // summary += (`\tLowest commission validator: ${lowestCommission} : ${lowestCommissionAmount / 10000000} %\n`)
  lowValidatorComm = {}
  lowValidatorComm['addr'] = lowestCommission
  lowValidatorComm['value'] = `${lowestCommissionAmount / 10000000} %`
  validatorStats['Lowest Commission Validator'] = lowValidatorComm

  summary['Validator Stats'] = validatorStats
  // // part 3
  nominatorStats = {}
  
  // summary += (`\tLowest Minimal Nominator: ${lowestMinNominator} : ${lowestMinStake / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  lowMinNominator = {}
  lowMinNominator['addr'] = lowestMinNominator
  lowMinNominator['value'] = lowestMinStake / DOT_DECIMAL_PLACES
  nominatorStats['Lowest Minimal Nominator'] = lowMinNominator
  // // summary += (`Lowest Non-Zero Minimal Nominator: ${lowestNonZeroMinNominator} : ${lowestNonZeroMinStake / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  // summary += (`\tHighest Minimal Nominator: ${highestMinNominator} : ${highestMinAmount / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  highMinNominator = {}
  highMinNominator['addr'] = highestMinNominator
  highMinNominator['value'] = highestMinAmount / DOT_DECIMAL_PLACES
  nominatorStats['Highest Minimal Nominator'] = highMinNominator
  // summary += (`\tHighest Minimal Nominator(non 100% commission validators): ${highestMinNominatorNon100} : ${highestMinAmountNon100 / DOT_DECIMAL_PLACES} ${getSuffix()}\n`)
  highMinNominatorNon100 = {}
  highMinNominatorNon100['addr'] = highestMinNominatorNon100
  highMinNominatorNon100['value'] = highestMinAmountNon100 / DOT_DECIMAL_PLACES
  nominatorStats['Highest Minimal Nominator(among non 100% commission validators'] = highMinNominatorNon100
  // summary += (`\tAverage Minimal Nomination: ${averageMinNomination / DOT_DECIMAL_PLACES} ${getSuffix()}\n`);
  nominatorStats['Average Minimal Nomination'] = averageMinNomination / DOT_DECIMAL_PLACES
  // summary += (`\tAverage Minimal Nomination (Among Non 100% Commission Validators): ${averageMinNominationNon100 / DOT_DECIMAL_PLACES} ${getSuffix()}\n`);
  nominatorStats['Average Minimal Nomination (among non 100% commission validators)'] = averageMinNominationNon100 / DOT_DECIMAL_PLACES

  summary['Nominator Stats'] = nominatorStats
  // // part 4
  // summary += (`\tAverage Stake Per Validator: ${averageTotalStake} ${getSuffix()}\n`)
  summary['Average Stake Per Validator'] = averageTotalStake
  // summary += (`\tAverage Commission: ${averageCommission / 10000000} %\n`)
  summary['Average Commission'] = `${averageCommission / 10000000} %`
  // summary += (`\tAverage Stake (Among Non 100% Commission Validators): ${averageStakeNon100} ${getSuffix()}\n`)
  summary['Average Stake (among non 100% commission validators'] = averageStakeNon100
  // summary += (`\tAverage Commission (Among Non 100% Commission Validators): ${averageCommissionNon100} %\n`)
  summary['Average Commission (among non 100% commission validators'] = `${averageCommissionNon100} %`

  stats['Body'] = body
  stats['Summary'] = summary
  console.log(JSON.stringify(stats, null, '\t'))
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

