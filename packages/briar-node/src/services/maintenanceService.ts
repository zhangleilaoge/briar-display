import { verificationCodeDal } from "../dal/verificationCodeDal"

export const maintenanceService = {
  async clearAllVerificationCodes() {
    return verificationCodeDal.deleteAll()
  },
}
