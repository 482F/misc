{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = {nixpkgs, ...}: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
  in {
    packages.${system}.default = pkgs.stdenv.mkDerivation rec {
      name = "totp";
      src = ./.;
      nativeBuildInputs = [pkgs.makeWrapper];
      buildCommand = ''
        mkdir -p $out/bin/

        cp -ai $src/${name}.ts $out/bin/${name}
        wrapProgram $out/bin/${name} --prefix PATH : ${pkgs.lib.makeBinPath [pkgs.deno]}

        comp_dest=$out/share/zsh/site-functions
        mkdir -p $comp_dest
        echo "#compdef totp" > $comp_dest/_totp
        echo "source <($out/bin/${name} completions zsh)" >> $comp_dest/_totp
        chmod 755 $comp_dest/_totp
      '';
    };
  };
}
