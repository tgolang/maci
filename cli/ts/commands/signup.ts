import { PubKey } from "maci-domainobjs"
import { info, logError, logGreen, logYellow, success } from "../utils/theme"
import { readContractAddress } from "../utils/storage"
import { contractExists } from "../utils/contracts"
import { getDefaultSigner, parseArtifact } from "maci-contracts"
import { DEFAULT_IVCP_DATA, DEFAULT_SG_DATA } from "../utils/defaults"
import { Contract } from "ethers"
import { SignUpArgs } from "../utils/interfaces"

/**
 * Signup a user to the MACI contract
 * @param param0 
 * @returns the state index of the user
 */
export const signup = async ({
    maciPubKey,
    maciAddress,
    sgDataArg,
    ivcpDataArg,
    quiet 
}: SignUpArgs): Promise<string> => {
    const signer = await getDefaultSigner()
    // validate user key
    if (!PubKey.isValidSerializedPubKey(maciPubKey)) logError('Invalid MACI public key')

    const userMaciPubKey = PubKey.deserialize(maciPubKey)

    if (!readContractAddress("MACI") && !maciAddress) logError('Invalid MACI contract address')

    const maciContractAddress = maciAddress ? maciAddress : readContractAddress("MACI")
    if (!(await contractExists(signer.provider, maciContractAddress))) logError('There is no contract deployed at the specified address')
    const sgData = sgDataArg ? sgDataArg : DEFAULT_SG_DATA
    const ivcpData = ivcpDataArg ? ivcpDataArg : DEFAULT_IVCP_DATA

    const regex32ByteHex = /^0x[a-fA-F0-9]{64}$/

    if (!sgData.match(regex32ByteHex)) logError('invalid signup gateway data')
    if (!ivcpData.match(regex32ByteHex)) logError('invalid initial voice credit proxy data')

    const maciContractAbi = parseArtifact('MACI')[0]
    const maciContract = new Contract(
        maciContractAddress,
        maciContractAbi,
        signer,
    )

    let stateIndex = ""
    try {
        const tx = await maciContract.signUp(
            userMaciPubKey.asContractParam(),
            sgData,
            ivcpData,
            { gasLimit: 1000000 }
        )
        const receipt = await tx.wait()
        if (receipt.status !== 1) logError('The transaction failed')
        const iface = maciContract.interface
        // get state index from the event
        if (receipt && receipt.logs) {
            const stateIndex = iface.parseLog(receipt.logs[0]).args[0]
            if (!quiet) logGreen(success(`State index: ${stateIndex.toString()}`))
        } else {
            logError('Unable to retrieve the transaction receipt')
        }
        if (!quiet) logYellow(info(`Transaction hash: ${tx.hash}`))
    } catch (error: any) {
        logError(error.message)
    }

    return stateIndex.toString()
}
