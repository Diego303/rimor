/** Límite de errores por pantalla: si una pantalla falla al pintar, lo dice con ErrorTarjeta y el resto sigue. */
import { Component, type ReactNode } from 'react';
import { t } from '../i18n/i18n';
import { Boton, ErrorTarjeta } from '../ui/componentes';

interface Props {
  /** Cambia al navegar: vuelve a intentar con la pantalla nueva. */
  clave: string;
  children: ReactNode;
}

interface Estado {
  error: Error | null;
  clave: string;
}

export class LimiteErrores extends Component<Props, Estado> {
  override state: Estado = { error: null, clave: this.props.clave };

  static getDerivedStateFromError(error: Error): Partial<Estado> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, estado: Estado): Partial<Estado> | null {
    return props.clave !== estado.clave ? { error: null, clave: props.clave } : null;
  }

  override componentDidCatch(error: Error): void {
    console.error(error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorTarjeta titulo={t('errores.pantalla.titulo')}>
        {t('errores.pantalla.texto')}{' '}
        <Boton pequeno onClick={() => this.setState({ error: null })}>
          {t('errores.pantalla.reintentar')}
        </Boton>
      </ErrorTarjeta>
    );
  }
}
