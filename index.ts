import { Tiramisu } from "./src/Tiramisu";

// Named Export: import { Tiramisu } from "tiramisu"
export { Tiramisu };

// Default Export: import Tiramisu from "tiramisu"
export default Tiramisu;

// Re-export types and utils
export * from "./src/types";
export { BROWSER_UTILS_CODE } from "./src/Utils";