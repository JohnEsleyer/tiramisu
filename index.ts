import { Tiramisu } from "./src/Tiramisu";

// This resolves "declared locally but not exported"
export { Tiramisu };

// This resolves errors when using "import Tiramisu from 'tiramisu'"
export default Tiramisu;

// Export all supporting types and utilities
export * from "./src/types";
export { BROWSER_UTILS_CODE } from "./src/Utils";