import logo from "../../../../resources/logo-nobackground.png";

export function BrandMark({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <img src={logo} alt="Fundz" />
    </>
  );

  if (onClick) {
    return (
      <button className="brandMark brandMarkButton" type="button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className="brandMark">
      {content}
    </div>
  );
}
