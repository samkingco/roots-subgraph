import { BigInt } from "@graphprotocol/graph-ts";
import {
  Roots,
  Transfer as TransferEvent,
  UpdatePriceCall,
} from "../generated/Roots/Roots";
import { RootsPhoto, RootsStatus, Transfer, Wallet } from "../generated/schema";

export function handleUpdatePrice(event: UpdatePriceCall): void {
  let rootsStatus = RootsStatus.load("roots.status");
  if (!rootsStatus) return;
  rootsStatus.primarySalePrice = event.inputs.newPrice;
  rootsStatus.save();
}

export function handleTransfer(event: TransferEvent): void {
  const tokenId = event.params.id;
  const fromAddress = event.params.from;
  const toAddress = event.params.to;
  const contract = Roots.bind(event.address);

  let rootsStatus = RootsStatus.load("roots.status");
  if (!rootsStatus) {
    rootsStatus = new RootsStatus("roots.status");
    rootsStatus.maxPhotos = BigInt.fromI32(40);
    rootsStatus.totalSold = BigInt.fromI32(0);
    rootsStatus.totalBurned = BigInt.fromI32(0);
    rootsStatus.primarySalePrice = contract.price();
  }

  let fromWallet = Wallet.load(fromAddress.toHexString());
  if (!fromWallet) {
    fromWallet = new Wallet(fromAddress.toHexString());
    fromWallet.address = fromAddress;
    fromWallet.save();
  }

  let toWallet = Wallet.load(toAddress.toHexString());
  if (!toWallet) {
    toWallet = new Wallet(toAddress.toHexString());
    toWallet.address = toAddress;
    toWallet.save();
  }

  // Burn
  if (toWallet.id === "0x0000000000000000000000000000000000000000") {
    rootsStatus.maxPhotos = BigInt.fromI32(
      rootsStatus.maxPhotos.minus(BigInt.fromI32(1)).toI32()
    );
    rootsStatus.totalBurned = BigInt.fromI32(
      rootsStatus.totalBurned.plus(BigInt.fromI32(1)).toI32()
    );
  }

  let token = RootsPhoto.load(tokenId.toString());
  if (!token) {
    token = new RootsPhoto(tokenId.toString());
    token.tokenId = tokenId;
    token.tokenURI = contract.tokenURI(tokenId);
    token.primarySaleAt = event.block.timestamp;
    token.primarySalePrice = contract.price();
    token.primarySaleBuyer = toWallet.id;
    token.ownerHistory.push(fromWallet.id);
    rootsStatus.totalSold = rootsStatus.totalSold.plus(BigInt.fromI32(1));
  }

  token.owner = toWallet.id;
  token.ownerHistory.push(toWallet.id);
  token.save();
  rootsStatus.save();

  let transfer = new Transfer(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );

  transfer.photo = token.id;
  transfer.from = fromWallet.id;
  transfer.to = toWallet.id;
  transfer.txHash = event.transaction.hash;
  transfer.timestamp = event.block.timestamp;
  transfer.save();
}
