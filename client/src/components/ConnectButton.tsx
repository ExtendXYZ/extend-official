import {ButtonGroupProps} from "@mui/material";
import {Settings} from "./Settings";

export type ConnectButtonProps = ButtonGroupProps & {
  isConnected: boolean;
  onClickConnect: () => void;
  onClickChange: () => void;
};

export const ConnectButton: React.FC<ConnectButtonProps> = ({
  isConnected,
  onClickConnect,
  onClickChange,
  ...restProps
}) => {
  return (
    <div   {...restProps}>
      <Settings/>
    </div>
  );
};

export default ConnectButton;
